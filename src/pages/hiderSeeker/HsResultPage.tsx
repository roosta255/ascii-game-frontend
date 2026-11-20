import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { Link } from "react-router-dom";

export function HsResultPage() {
  const { resultLines, resultFrom, matchId } = useHsMatch();
  
  if (resultLines.length > 0) {
    return (
      <>
        <ul>
          {resultLines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
        <br />
        <Link to={resultFrom || `/hs/${matchId}`}>Back</Link>
      </>
    );
  } else {
    return (
      <>
        <p>No move yet.</p>
        <br />
        <Link to={resultFrom || `/hs/${matchId}`}>Back</Link>
      </>
    );
  }
}