import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHsClient } from "../hiderSeeker/hsApi";

const client = createHsClient(API_BASE, (url, init) => fetch(url, init), () => crypto.randomUUID());

export default function HiderSeekerLobbyPage() {
  const [hiderCount, setHiderCount] = useState<number>(2);
  const [npcHiders, setNpcHiders] = useState<number>(1);
  const [matchId, setMatchId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async () => {
    const seed = Math.floor(Math.random() * 1000000);
    const response = await client.createMatch("alice", hiderCount, npcHiders, seed);
    
    if (response.status === 201) {
      navigate(`/hs/${response.body.match_id}`);
    } else {
      setError(response.body?.message ?? `Create failed (${response.status})`);
    }
  };

  const handleOpen = () => {
    if (matchId.trim() !== "") {
      navigate(`/hs/${matchId}`);
    }
  };

  return (
    <div>
      <h1>Hider-Seeker</h1>
      
      <div>
        <h2>Create a new match</h2>
        <div>
          <label>
            Hiders: 
            <input
              type="number"
              min={1}
              max={4}
              value={hiderCount}
              onChange={(e) => setHiderCount(parseInt(e.target.value) || 1)}
            />
          </label>
        </div>
        
        <div>
          <label>
            NPC Hiders: 
            <input
              type="number"
              min={0}
              max={hiderCount - 1}
              value={npcHiders}
              onChange={(e) => setNpcHiders(parseInt(e.target.value) || 0)}
            />
          </label>
        </div>
        
        <button onClick={handleCreate}>Create</button>
      </div>
      
      <div>
        <h2>Open an existing match</h2>
        <div>
          <label>
            Match ID: 
            <input
              type="text"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
            />
          </label>
        </div>
        <button onClick={handleOpen} disabled={!matchId.trim()}>Open</button>
      </div>
      
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}