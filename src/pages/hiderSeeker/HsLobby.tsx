import { useHsMatch } from "../../hiderSeeker/HsMatchContext";

export function HsLobby() {
  const { match, account, client } = useHsMatch();
  
  if (!match) {
    return null;
  }
  
  const isJoined = match.hiders.some((hider: any) => hider.account === account);
  
  return (
    <div>
      <h2>Hider-Seeker</h2>
      <p>Match {match.match_id}, lobby</p>
      <ul>
        {match.hiders.map((hider: any, index: number) => (
          <li key={index}>Hider {hider.hider_id}: {hider.account ?? "open"}</li>
        ))}
      </ul>
      
      {!isJoined && (
        <button onClick={async () => {
          const response = await client.joinMatch(match.match_id, account, match.revision);
          // We can't call handle here since it's not in the context - we'll just refresh
          window.location.reload();
        }}>
          Join
        </button>
      )}
      
      {match.host === account && (
        <button onClick={async () => {
          const response = await client.startMatch(match.match_id, account, match.revision);
          // We can't call handle here since it's not in the context - we'll just refresh
          window.location.reload();
        }}>
          Start
        </button>
      )}
    </div>
  );
}