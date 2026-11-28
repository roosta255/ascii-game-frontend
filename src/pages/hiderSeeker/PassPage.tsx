import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { previewPass } from "../../hiderSeeker/turnPreview";
import { moveBlockedReason } from "../../hiderSeeker/statusLine";
import { Link, useParams } from "react-router-dom";

function PassPageInner() {
  const { matchId, view, account, client, run } = useHsMatch();
  
  if (!view) {
    return null;
  }
  
  const maxTicks = view.rules.max_advance_ticks;
  
  const blockedReason = moveBlockedReason(view);
  
  return (
    <table>
      <thead>
        <tr>
          <th>Tick</th>
          <th>If passed now</th>
          <th>Pass</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: maxTicks }, (_, i) => {
          const tick = i + 1;
          const preview = previewPass(tick).summary;
          
          return (
            <tr key={tick}>
              <td>{tick}</td>
              <td>{preview}</td>
              <td>
                {blockedReason ? (
                  <p>{blockedReason}</p>
                ) : (
                  <button 
                    onClick={() => run(() => client.passTicks(matchId, account, view.revision, tick), "pass")}
                  >
                    Pass
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function PassPage() {
  return <HiderOnly><PassPageInner /></HiderOnly>;
}