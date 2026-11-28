import { useHsMatch } from "./HsMatchContext";
import { Link } from "react-router-dom";

export function HsMenu() {
  const { matchId, mode } = useHsMatch();
  
  if (!matchId) {
    return null;
  }
  
  // For a hider the links are exactly:
  // - Hub (/hs/<matchId>)
  // - Goals (/hs/<matchId>/goals)
  // - Last result (/hs/<matchId>/result)
  // - Rack (/hs/<matchId>/rack)
  // - Move queue (/hs/<matchId>/queue)
  // - Pass time (/hs/<matchId>/pass)
  // - Classic (/hs/<matchId>/classic).
  // For a spectator the links are exactly:
  // - Hub (/hs/<matchId>)
  // - Classic (/hs/<matchId>/classic).
  
  return (
    <nav>
      <Link to={`/hs/${matchId}`}>Hub</Link> | 
      {mode === "PLAY" && (
        <>
          {" "}
          <Link to={`/hs/${matchId}/goals`}>Goals</Link> | 
          <Link to={`/hs/${matchId}/rack`}>Rack</Link> | 
          <Link to={`/hs/${matchId}/queue`}>Move queue</Link> | 
          <Link to={`/hs/${matchId}/pass`}>Pass time</Link> | 
          <Link to={`/hs/${matchId}/result`}>Last result</Link> | 
        </>
      )}
      {" "}
      <Link to={`/hs/${matchId}/classic`}>Classic</Link>
    </nav>
  );
}