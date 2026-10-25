import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { createHsClient } from "../hiderSeeker/hsApi";
import { pageMode } from "../hiderSeeker/pageMode";
import { previewMove, previewPass, describeMoveResult, MAX_ADVANCE_TICKS } from "../hiderSeeker/turnPreview";
import { buildMoveOptions, ownPendingMoves, goalText } from "../hiderSeeker/moveOptions";

const client = createHsClient(API_BASE, (url, init) => fetch(url, init), () => crypto.randomUUID());
const POLL_MS = 3000;

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

  const handle = async (response: any) => {
    if (response.status === 200) {
      setError(null);
      
      // If the response has a status field, it's likely a move or cancel result
      if (response.body && response.body.status) {
        setLines(describeMoveResult(response.body));
      } else {
        setLines([]);
      }
    } else if (response.body?.error === "STALE_REVISION") {
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
    return <div>{error ?? "Loading..."}</div>;
  }

  const mode = pageMode(match, account);
  
  if (mode === "LOBBY") {
    const isJoined = match.hiders.some((hider: any) => hider.account === account);
    
    return (
      <div>
        <h1>Match {matchId} (lobby)</h1>
        <ul>
          {match.hiders.map((hider: any, index: number) => (
            <li key={index}>Hider {hider.hider_id}: {hider.account ?? "open"}</li>
          ))}
        </ul>
        
        {!isJoined && (
          <button onClick={() => handle(client.joinMatch(matchId, account, match.revision))}>
            Join
          </button>
        )}
        
        {match.host === account && (
          <button onClick={() => handle(client.startMatch(matchId, account, match.revision))}>
            Start
          </button>
        )}
        
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  if (mode === "NOT_A_HIDER") {
    return (
      <div>
        Match {matchId} is {match.phase}. You are not a hider in it.
      </div>
    );
  }

  // mode === "PLAY"
  if (view === null) {
    return <div>Loading view...</div>;
  }

  const ownPending = ownPendingMoves(view);
  
  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      <h1>Match {matchId}: {view.phase}, tick {view.tick}, revision {view.revision}</h1>
      
      {view.winner && <p>Winner: {view.winner}</p>}
      
      <p>Team reward {view.team_reward} / {view.reward_target}. Team connections left: {view.team_connections}.</p>
      
      <p>
        Hider {view.self.hider_id}: {view.self.status}, 
        AP: {view.self.action_points}, LOA: {view.self.loa}, 
        {view.self.server_id === null ? "disconnected" : `on server ${view.self.server_id}`}
      </p>
      
      <h2>Team</h2>
      <ul>
        {view.team.map((member: any) => (
          <li key={member.hider_id}>
            Hider {member.hider_id}: {member.account ?? "open"}, 
            {member.status}, 
            {member.server_id === null ? "disconnected" : `on server ${member.server_id}`}
          </li>
        ))}
      </ul>
      
      <h2>Servers</h2>
      <table border={1}>
        <thead>
          <tr>
            <th>server</th>
            {Object.keys(view.servers[0]?.metrics || {}).map(key => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.servers.map((server: any) => (
            <tr key={server.server_id}>
              <td>{server.server_id}</td>
              {Object.keys(view.servers[0]?.metrics || {}).map(key => (
                <td key={key}>{String(server.metrics[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <h2>Goals</h2>
      <ul>
        {view.goals.map((goal: any) => (
          <li key={goal.goal_id}>{goalText(goal)}</li>
        ))}
      </ul>
      
      <h2>Pending moves</h2>
      <ul>
        {view.pending.map((move: any) => (
          <li key={move.intent_id}>
            {move.queue_position}, {move.intent_id}, hider {move.hider_id}, {move.action}
            {move.server_id !== null && ` on server ${move.server_id}`}
            {ownPending.includes(move) && (
              <button onClick={() => handle(client.cancelMove(matchId, account, view.revision, move.intent_id))}>
                Cancel
              </button>
            )}
          </li>
        ))}
      </ul>
      
      {view.phase === "ACTIVE" && view.self.status === "ACTIVE" && (
        <>
          <h2>Moves</h2>
          <table border={1}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Action</th>
                <th>Preview</th>
                <th>Queue</th>
              </tr>
            </thead>
            <tbody>
              {buildMoveOptions(view).map((option: any) => (
                <tr key={option.label}>
                  <td>{option.label}</td>
                  <td>
                    <button onClick={() => handle(client.submitMove(matchId, account, view.revision, "PLAY", option.intent))}>
                      Play
                    </button>
                  </td>
                  <td>{previewMove(view, option.intent.type, "PLAY").summary}</td>
                  <td>
                    <button onClick={() => handle(client.submitMove(matchId, account, view.revision, "QUEUE", option.intent))}>
                      Queue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div>
            <label>
              Pass ticks: 
              <input
                type="number"
                min={1}
                max={MAX_ADVANCE_TICKS}
                value={passTicks}
                onChange={(e) => setPassTicks(parseInt(e.target.value) || 1)}
              />
            </label>
            <button onClick={() => handle(client.passTicks(matchId, account, view.revision, passTicks))}>
              Pass
            </button>
            <p>{previewPass(passTicks).summary}</p>
          </div>
        </>
      )}
      
      <ul>
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}