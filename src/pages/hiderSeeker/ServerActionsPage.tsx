import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { serverAccess } from "../../hiderSeeker/rack";
import { apCost, effectText, SERVER_ACTION_ROWS } from "../../hiderSeeker/actions";
import { previewMove } from "../../hiderSeeker/turnPreview";
import { moveBlockedReason } from "../../hiderSeeker/statusLine";
import { actionName } from "../../hiderSeeker/viewText";
import { Link, useParams } from "react-router-dom";

function ServerActionsPageInner() {
  const { serverId: serverIdParam } = useParams<{ serverId: string }>();
  const n = parseInt(serverIdParam || '0', 10);
  
  const { matchId, view, account, client, run } = useHsMatch();
  
  if (!view) {
    return null;
  }
  
  // Check if the hider is connected to this server
  const access = serverAccess(view, n);
  
  if (access !== "HERE") {
    return (
      <>
        <p>You're not connected to server {n}.</p>
        <Link to={`/hs/${matchId}/servers/${n}`}>Back to server details</Link>
      </>
    );
  }
  
  const blockedReason = moveBlockedReason(view);
  
  return (
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>AP</th>
          <th>Visible effect</th>
          <th>If played now</th>
          <th>Buttons</th>
        </tr>
      </thead>
      <tbody>
        {SERVER_ACTION_ROWS.map((type) => {
          const ap = apCost(view, type);
          const effect = effectText(view, type);
          const preview = previewMove(view, type, "PLAY").summary;
          
          return (
            <tr key={type}>
              <td>{actionName(type)}</td>
              <td>{ap}</td>
              <td>{effect}</td>
              <td>{preview}</td>
              <td>
                {blockedReason ? (
                  <p>{blockedReason}</p>
                ) : (
                  <>
                    <button 
                      onClick={() => run(() => client.submitMove(matchId, account, view.revision, "PLAY", { type }), `servers/${n}/actions`)}
                    >
                      Play
                    </button>
                    <button 
                      onClick={() => run(() => client.submitMove(matchId, account, view.revision, "QUEUE", { type }), `servers/${n}/actions`)}
                    >
                      Queue
                    </button>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ServerActionsPage() {
  return <HiderOnly><ServerActionsPageInner /></HiderOnly>;
}