import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function JoinMatchPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/match/${id}`)
      .then(res => res.json())
      .then(setMatch)
      .catch(() => setError("Could not load match"));
  }, [id]);

  function joinMatch() {
    fetch(`/api/match/${id}/join`, { method: "POST" })
      .then(res => {
        if (!res.ok) throw new Error("Join failed");
        return res.json();
      })
      .then(() => navigate(`/match/${id}`))
      .catch(() => setError("Could not join match"));
  }

  if (error) return <div>{error}</div>;
  if (!match) return <div>Loading match...</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Join Match {id}</h2>
      <p>Status: {match.status}</p>
      <p>Players: {match.players.join(", ")}</p>
      <button onClick={joinMatch}>Join</button>
    </div>
  );
}