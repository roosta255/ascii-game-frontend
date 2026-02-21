import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface MatchSummary {
  filename: string;
  username: string;
  host: string;
  generator: string;
  isCompleted: boolean;
  isStarted: boolean;
  isFull: boolean;
  isEmpty: boolean;
  turners: string[];
  titan: { player: { account: string } };
  builders: { player: { account: string } }[];
}

export default function LobbyPage() {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  const { account: currentAccount } = useAuth();

  useEffect(() => {
    fetch(`${API_BASE}/api/matches`)
      .then(res => res.json())
      .then(async data => {
        const matchIds = data.matches;
        const fullMatches: MatchSummary[] = await Promise.all(
          matchIds.map(async (id: string) => {
            const res = await fetch(`${API_BASE}/api/match/${id}`);
            const matchJsonString = await res.json(); // <-- this is a string
            const matchData: MatchSummary = JSON.parse(matchJsonString); // manually parse it
            return matchData;
          })
        );
        setMatches(fullMatches);
      })
      .catch(err => console.error("Failed to load matches", err));
  }, [refreshKey]);

  useEffect(() => {
    if (matches) {
      console.log("Joinable match keys(useEffect wrapped):", matches
        .filter(m => !m.isCompleted && !isPlayer(m) && !m.isFull && !m.isEmpty)
        .map(m => m.filename));
    }
  }, [matches]);

  function reload() {
    setRefreshKey(k => k + 1);
  }

  const isPlayer = (match: MatchSummary) =>
    match.titan?.player?.account === currentAccount ||
    match.builders?.some(b => b.player.account === currentAccount);

  const isHost = (match: MatchSummary) =>
    match.host === currentAccount;

  const joinedMatches = (matches ?? []).filter(
    m => !m.isCompleted && isPlayer(m)
  );

  const joinableMatches = (matches ?? []).filter(
    m =>
      !m.isCompleted &&
      !isPlayer(m) &&
      !m.isFull &&
      !m.isEmpty
  );

  console.log("Joinable match keys:", joinableMatches.map(m => m.filename));

  function status(match: MatchSummary): string {
    if (match.isCompleted) return "completed";
    if (!match.isStarted) return "not started";
    if (currentAccount && match.turners?.includes(currentAccount)) return "playing";
    return "waiting";
  }

  function joinMatch(matchId: string) {
    fetch(`${API_BASE}/api/match/${matchId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: currentAccount }),
    }).then(() => reload());
  }

  function leaveMatch(matchId: string) {
    fetch(`${API_BASE}/api/match/${matchId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: currentAccount }),
    }).then(() => reload());
  }

  function startMatch(matchId: string) {
    fetch(`${API_BASE}/api/match/${matchId}/start`, {
      method: "POST"
    }).then(() => reload());
  }

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Ian's Dungeon Server</h1>

      <CreateMatchForm onCreate={reload} />

      <h2>Your Matches</h2>
      {joinedMatches.length > 0 ? (
        <table border={1} cellPadding={8} style={{ marginBottom: "2rem" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Generator</th>
              <th>Status</th>
              <th>Open</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {joinedMatches.map(match => (
              <tr key={match.filename}>
                <td>{match.username}</td>
                <td>{match.host}</td>
                <td>{match.generator}</td>
                <td>{status(match)}</td>
                <td>
                  <button onClick={() => navigate(`/match/${match.filename}`)}>Open</button>
                </td>
                <td>
                  <button onClick={() => leaveMatch(match.filename)}>Leave</button>
                  {" "}
                  {isHost(match) && !match.isStarted && (
                    <button onClick={() => startMatch(match.filename)}>Start</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>You are not in any active matches.</p>
      )}

      <h2>Available Matches</h2>
      {joinableMatches.length > 0 ? (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Generator</th>
              <th>Open</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {joinableMatches.map(match => (
              <tr key={match.filename}>
                <td>{match.username}</td>
                <td>{match.host}</td>
                <td>{match.generator}</td>
                <td>
                  <button onClick={() => navigate(`/match/${match.filename}`)}>Open</button>
                </td>
                <td>
                  <button onClick={() => joinMatch(match.filename)}>Join</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No open matches available to join.</p>
      )}
    </div>
  );
}

function CreateMatchForm({ onCreate }: { onCreate: () => void }) {
  const [name, setName] = useState("");
  const [generator, setGenerator] = useState("");
  const [generators, setGenerators] = useState<string[]>([]);

  const { account: currentAccount } = useAuth();

  console.log("BASE_URL =", import.meta.env.BASE_URL);
  console.log("API_BASE =", API_BASE);

  useEffect(() => {
    fetch(`${API_BASE}/api/generators`)
      .then(res => res.json())
      .then(data => setGenerators(data.generators || []))
      .catch(err => console.error("Failed to load generators", err));
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    fetch(`${API_BASE}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        generator,
        host: currentAccount,
      }),
    })
      .then(res => res.ok ? res.json() : res.text().then(t => { throw new Error(t); }))
      .then(() => {
        setName("");
        setGenerator("");
        onCreate(); // refresh the match list
      })
      .catch(err => console.error("Failed to create match", err));
  }

  return (
    <form onSubmit={submit} style={{ marginBottom: "2rem" }}>
      <h2>Create New Match</h2>
      <label>
        Name:{" "}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </label>{" "}
      <label>
        Generator:{" "}
        <select
          value={generator}
          onChange={e => setGenerator(e.target.value)}
          required
        >
          <option value="">-- Select a generator --</option>
          {generators.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="submit">Create Match</button>
    </form>
  );
}
