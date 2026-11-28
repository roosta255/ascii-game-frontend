import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { Link } from "react-router-dom";
import { rackSlots, lightsLine, occupancy, serverAccess, goalsNeedingServer, relocationTarget } from "../../hiderSeeker/rack";
import { previewMove } from "../../hiderSeeker/turnPreview";
import { moveBlockedReason } from "../../hiderSeeker/statusLine";

export function RackPage() {
  const { mode, view, publicView, client, run } = useHsMatch();
  
  const currentView = mode === "PLAY" ? view : publicView;
  if (!currentView) {
    return <p>Loading...</p>;
  }
  
  const slots = rackSlots(currentView.servers);
  const isHider = mode === "PLAY";
  
  const tableRows = slots.map((slot, index) => {
    if (slot.server) {
      // Active server row
      const server = slot.server;
      
      return (
        <tr key={index}>
          <td>
            <Link to={`/hs/${currentView.match_id}/servers/${server.server_id}`}>
              S{server.server_id}
            </Link>
          </td>
          <td aria-label={`server ${server.server_id} heat ${server.lights.heat ? 'on' : 'off'}`}>
            HEAT {server.lights.heat ? "\u25A0" : "\xB7"}
          </td>
          <td aria-label={`server ${server.server_id} errors ${server.lights.errors ? 'on' : 'off'}`}>
            ERR {server.lights.errors ? "\u25A0" : "\xB7"}
          </td>
          <td aria-label={`server ${server.server_id} seeker ${server.lights.seeker_connected ? 'connected' : 'disconnected'}`}>
            SEEK {server.lights.seeker_connected ? "\u25A0" : "\xB7"}
          </td>
          {isHider && (
            <td>{occupancy(currentView, server.server_id)}</td>
          )}
        </tr>
      );
    } else {
      // Empty slot row
      const colspan = isHider ? 4 : 3;
      return (
        <tr key={index}>
          <td>S{index}</td>
          <td colSpan={colspan}>empty</td>
        </tr>
      );
    }
  });
  
  const headerRow = (
    <tr>
      <th>Server</th>
      <th>HEAT</th>
      <th>ERR</th>
      <th>SEEK</th>
      {isHider && <th>Occupancy</th>}
    </tr>
  );
  
  const table = (
    <table>
      <thead>{headerRow}</thead>
      <tbody>{tableRows}</tbody>
    </table>
  );
  
  // For hiders, we need to show the add server button and preview
  if (isHider && currentView.phase !== 'COMPLETE') {
    return (
      <>
        {table}
        <button>
          Add server (1 LOA)
        </button>
        <p>{previewMove(currentView, "ADD_SERVER", "PLAY").summary}</p>
        <button disabled={currentView.self.loa < 1}
                onClick={() => run(() => client.submitMove(currentView.match_id, currentView.self.account, currentView.revision, "PLAY", { type: "ADD_SERVER" }), "rack")}>
          Play
        </button>
        <button disabled={currentView.self.loa < 1}
                onClick={() => run(() => client.submitMove(currentView.match_id, currentView.self.account, currentView.revision, "QUEUE", { type: "ADD_SERVER" }), "rack")}>
          Queue
        </button>
      </>
    );
  }
  
  return table;
}