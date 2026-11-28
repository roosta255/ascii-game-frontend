import { useHsMatch } from "./HsMatchContext";
import { Link } from "react-router-dom";

export function HsMenu() {
  const { matchId, mode } = useHsMatch();
  
  if (!matchId) {
    return null;
  }
  
  // For a hider the links are exactly:
  // - Hub (/hs/<matchId>)
  // - Last result (/hs/<matchId>/result)
  // - Rack (/hs/<matchId>/rack)
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
          <Link to={`/hs/${matchId}/rack`}>Rack</Link> | 
          <Link to={`/hs/${matchId}/result`}>Last result</Link> | 
        </>
      )}
      {" "}
      <Link to={`/hs/${matchId}/classic`}>Classic</Link>
    </nav>
  );
}