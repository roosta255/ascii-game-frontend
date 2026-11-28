import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { Link } from "react-router-dom";

function ResultPageInner() {
  const { matchId, resultLines, error, resultFrom } = useHsMatch();
  
  if (!matchId) {
    return null;
  }
  
  return (
    <>
      {resultLines.length > 0 ? (
        <ul>
          {resultLines.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ) : (
        <p>No move yet.</p>
      )}
      
      {error && <p>{error}</p>}
      
      <Link to={resultFrom ? `/hs/${matchId}/${resultFrom}` : `/hs/${matchId}`}>Back</Link>
    </>
  );
}

export function ResultPage() {
  return <HiderOnly><ResultPageInner /></HiderOnly>;
}