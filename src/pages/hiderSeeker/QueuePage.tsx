import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { actionName } from "../../hiderSeeker/viewText";
import { Link } from "react-router-dom";

function QueuePageInner() {
  const { matchId, view, account, client, run } = useHsMatch();
  
  if (!view) {
    return null;
  }
  
  // If no pending moves, show "None."
  if (!view.pending || view.pending.length === 0) {
    return <p>None.</p>;
  }
  
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Action</th>
          <th>Target</th>
          <th>Hider</th>
          <th>Your move</th>
        </tr>
      </thead>
      <tbody>
        {view.pending.slice(0, 16).map((move: any) => {
          const isOwnMove = move.hider_id === view.self.hider_id;
          
          return (
            <tr key={move.intent_id}>
              <td>{move.queue_position + 1}</td>
              <td>{actionName(move.action)}</td>
              <td>{move.action === 'REMOVE_SERVER' ? `S${move.server_id}` : ''}</td>
              <td>{move.hider_id}</td>
              <td>
                {isOwnMove ? (
                  <>
                    YOU
                    <button 
                      onClick={() => run(() => client.cancelMove(matchId, account, view.revision, move.intent_id), "queue")}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function QueuePage() {
  return <HiderOnly><QueuePageInner /></HiderOnly>;
}