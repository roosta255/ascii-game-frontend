import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { createHsClient, isStaleRevision, HsResponse } from "../hiderSeeker/hsApi";
import { pageMode } from "../hiderSeeker/pageMode";
import { previewMove, previewPass, describeMoveResult } from "../hiderSeeker/turnPreview";
import { buildMoveOptions, ownPendingMoves, goalText, MoveOption } from "../hiderSeeker/moveOptions";
import { METRIC_ORDER, matchSummary, selfSummary, teammateSummary, pendingSummary } from "../hiderSeeker/viewText";

const client = createHsClient(API_BASE, (url, init) => fetch(url, init), () => crypto.randomUUID());
const POLL_MS = 3000;

// /hs/:matchId: the match lobby (join, start) and, once it is active, the
// hider's turn UI over the latest hider view.
export default function HiderSeekerPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { account } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [passTicks, setPassTicks] = useState<number>(1);
  const etag = useRef<string | null>(null);

  const refresh = async () => {
    if (!matchId || !account) {
      return;
    }

    const response = await client.getMatch(matchId);
    
    if (response.status !== 200) {
      setError(response.body?.message ?? `Match not found (${response.status})`);
      return;
    }
    
    setMatch(response.body);
    
    // Only fetch view if we're in PLAY mode
    if (pageMode(response.body, account) === "PLAY") {
      const viewResponse = await client.getHiderView(matchId, account, etag.current);
      
      if (viewResponse.status === 200) {
        etag.current = viewResponse.etag;
        setView(viewResponse.body);
      } else if (viewResponse.status !== 304) {
        // For any other error status, we don't update the view
      }
    }
  };

  useEffect(() => {
    if (!matchId || !account) {
      return;
    }

    refresh();
    const interval = setInterval(refresh, POLL_MS);
    
    return () => {
      clearInterval(interval);
    };
  }, [matchId, account]);

  const handle = async (response: HsResponse) => {
    if (response.status === 200) {
      setError(null);
      
      // If the response has a status field, it's likely a move or cancel result
      if (response.body && response.body.status) {
        setLines(describeMoveResult(response.body));
      } else {
        setLines([]);
      }
    } else if (isStaleRevision(response)) {
      setError(`The match moved on to revision ${response.body.revision}. Check the new state and resubmit.`);
    } else {
      setError(response.body?.message ?? `Request failed (${response.status})`);
    }
    
    await refresh();
  };

  if (!matchId || !account) {
    return null;
  }

  if (match === null) {
    return <div style={{ padding: 16 }}>{error ?? "Loading..."}</div>;
  }

  const mode = pageMode(match, account);
  
  if (mode === "LOBBY") {
    const isJoined = match.hiders.some((hider: any) => hider.account === account);
    
    return (
      <div style={{ padding: 16 }}>
        <h2>Hider-Seeker</h2>
        <p>Match {matchId}, lobby</p>
        <ul>
          {match.hiders.map((hider: any, index: number) => (
            <li key={index}>Hider {hider.hider_id}: {hider.account ?? "open"}</li>
          ))}
        </ul>
        
        {!isJoined && (
          <button onClick={async () => handle(await client.joinMatch(matchId, account, match.revision))}>
            Join
          </button>
        )}
        
        {match.host === account && (
          <button onClick={async () => handle(await client.startMatch(matchId, account, match.revision))}>
            Start
          </button>
        )}
        
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  if (mode === "NOT_A_HIDER") {
    return (
      <div style={{ padding: 16 }}>
        Match {matchId} is {match.phase}. You are not a hider in it.
      </div>
    );
  }

  // mode === "PLAY"
  if (view === null) {
    return <div style={{ padding: 16 }}>Loading view...</div>;
  }

  const ownPending = ownPendingMoves(view);
  
  return (
    <div style={{ padding: 16 }}>
      <h2>Hider-Seeker</h2>
      <p>{matchSummary(view)}</p>
      {view.winner && <p>Winner: {view.winner}</p>}
      
      <p>Team reward {view.team_reward} / {view.reward_target}. Team connections left: {view.team_connections}.</p>
      
      <p>You: {selfSummary(view)}</p>
      
      <h3>Team</h3>
      <ul>
        {view.team.map((mate: any) => (
          <li key={mate.hider_id}>{teammateSummary(mate)}</li>
        ))}
      </ul>
      
      <h3>Servers</h3>
      <div style={{ overflowX: "auto" }}>
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>server</th>
              {METRIC_ORDER.map((metric) => (
                <th key={metric}>{metric}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.servers.map((server: any) => (
              <tr key={server.server_id}>
                <td>{server.server_id}</td>
                {METRIC_ORDER.map((metric) => (
                  <td key={metric}>{String(server.metrics[metric])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <h3>Goals</h3>
      <ul>
        {view.goals.map((goal: any) => (
          <li key={goal.goal_id}>{goalText(goal)}</li>
        ))}
      </ul>
      
      <h3>Pending moves</h3>
      {view.pending.length === 0 && <p>None.</p>}
      <ul>
        {view.pending.map((move: any) => (
          <li key={move.intent_id}>
            {pendingSummary(move, view.self.hider_id)}{" "}
            {ownPending.includes(move) && (
              <button onClick={async () => handle(await client.cancelMove(matchId, account, view.revision, move.intent_id))}>
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
      
      {lines.length > 0 && (<ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul>)}
      
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {view.phase === "ACTIVE" && view.self.status === "ACTIVE" && (
        <>
          <h3>Moves</h3>
          <div style={{ overflowX: "auto" }}>
            <table border={1} cellPadding={4}>
              <thead>
                <tr>
                  <th>Move</th>
                  <th>If played now</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {buildMoveOptions(view).map((option: MoveOption) => (
                  <tr key={option.label}>
                    <td>{option.label}</td>
                    <td>{previewMove(view, option.intent.type, "PLAY").summary}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button onClick={async () => handle(await client.submitMove(matchId, account, view.revision, "PLAY", option.intent))}>
                        Play
                      </button>{" "}
                      <button onClick={async () => handle(await client.submitMove(matchId, account, view.revision, "QUEUE", option.intent))}>
                        Queue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <p>
            <label>Pass </label>
            <input
              type="number"
              min={1}
              max={view.rules.max_advance_ticks}
              value={passTicks}
              onChange={(e) => setPassTicks(parseInt(e.target.value) || 1)}
            />
            {" "}ticks{" "}
            <button onClick={async () => handle(await client.passTicks(matchId, account, view.revision, passTicks))}>
              Pass
            </button>
            {" "}{previewPass(passTicks).summary}
          </p>
        </>
      )}
    </div>
  );
}