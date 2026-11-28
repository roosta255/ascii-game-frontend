import { useParams } from 'react-router-dom';
import { useHsMatch } from '../../hiderSeeker/HsMatchContext';
import { lightsLine, goalsNeedingServer, serverAccess } from '../../hiderSeeker/rack';
import { moveBlockedReason } from '../../hiderSeeker/statusLine';
import { Link } from 'react-router-dom';
import Sparkline from '../../hiderSeeker/Sparkline';
import { METRIC_ORDER } from '../../hiderSeeker/viewText';

export function ServerPage() {
  const { serverId: serverIdParam } = useParams<{ serverId: string }>();
  const n = parseInt(serverIdParam || '0', 10);
  
  const { mode, view, publicView, run, client } = useHsMatch();
  
  // Determine the server object based on mode
  let server;
  if (mode === "PLAY") {
    server = view.servers.find((s: any) => s.server_id === n);
  } else {
    server = publicView.servers.find((s: any) => s.server_id === n);
  }
  
  // If server is not found, render inactive server message
  if (!server) {
    return <h2>Server {n} is not active.</h2>;
  }
  
  const isHider = mode === "PLAY";
  const matchId = (isHider ? view : publicView).match_id;
  
  // Get move blocked reason and access info for hiders
  let reason = null;
  let access = null;
  let goals = [];
  
  if (isHider && view) {
    reason = moveBlockedReason(view);
    access = serverAccess(view, n);
    goals = goalsNeedingServer(view, n);
  }
  
  // If move is blocked or match is complete, show the reason and skip hider-only content
  if ((reason !== null || (view && view.phase === 'COMPLETE')) && isHider) {
    return (
      <>
        <h2>Server {n}</h2>
        <p>{lightsLine(server.lights)}</p>
        {server.metrics !== null && (
          <table>
            <thead>
              <tr><th>Metric</th><th>Current</th><th>History</th></tr>
            </thead>
            <tbody>
              {METRIC_ORDER.map((metric: string) => (
                <tr key={metric}>
                  <td>{metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                  <td>{server.metrics[metric]}</td>
                  <td><Sparkline values={[...server.history.map((f: any) => f[metric]), server.metrics[metric]]} label={`${metric} history`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {server.metrics === null && (
          <p>Connect to see this server's metrics.</p>
        )}
        <p>{reason || "No moves: the match is over."}</p>
      </>
    );
  }
  
  // Hider-only content
  let onItLine = null;
  if (isHider && view) {
    if (view.self.server_id === n) {
      onItLine = <p>On it: You</p>;
    } else {
      const teammatesOnServer = view.team.filter((t: any) => t.server_id === n);
      if (teammatesOnServer.length > 0) {
        const teammateNames = teammatesOnServer.map((t: any) => `hider ${t.hider_id}`).join(', ');
        onItLine = <p>On it: {teammateNames}</p>;
      } else {
        onItLine = <p>On it: nobody you know of</p>;
      }
    }
  }
  
  // Render the main content
  return (
    <>
      <h2>Server {n}</h2>
      <p>{lightsLine(server.lights)}</p>
      
      {isHider && view && onItLine}
      
      {isHider && view && (
        <p>
          Goals that need it:{" "}
          {goals.length === 0
            ? "none"
            : goals.map((id: number, i: number) => (
                <span key={id}>
                  {i > 0 && ", "}
                  <Link to={`/hs/${matchId}/goals/${id}`}>#{id}</Link>
                </span>
              ))}
        </p>
      )}
      
      {server.metrics !== null ? (
        <table>
          <thead>
            <tr><th>Metric</th><th>Current</th><th>History</th></tr>
          </thead>
          <tbody>
            {METRIC_ORDER.map((metric: string) => (
              <tr key={metric}>
                <td>{metric.charAt(0).toUpperCase() + metric.slice(1)}</td>
                <td>{server.metrics[metric]}</td>
                <td><Sparkline values={[...server.history.map((f: any) => f[metric]), server.metrics[metric]]} label={`${metric} history`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Connect to see this server's metrics.</p>
      )}
      
      {isHider && view && access === "DISCONNECTED" && (
        <>
          <button disabled={view.team_connections === 0}
            onClick={() => run(() => client.submitMove(view.match_id, view.self.account, view.revision, "PLAY", { type: "CONNECT", server_id: n }), `servers/${n}`)}>
            Connect (uses 1 of {view.team_connections} team connections)
          </button>
        </>
      )}
      
      {isHider && view && access === "ELSEWHERE" && (
        <>
          <p>You're connected to server {view.self.server_id}.</p>
          <Link to={`/hs/${matchId}/servers/${view.self.server_id}`}>Go to server {view.self.server_id}</Link>
          <button onClick={() => run(() => client.submitMove(view.match_id, view.self.account, view.revision, "PLAY", { type: "DISCONNECT" }), `servers/${n}`)}>
            Disconnect
          </button>
        </>
      )}
      
      {isHider && view && access === "HERE" && (
        <>
          <Link to={`servers/${n}/actions`}>Act on this server</Link>
        </>
      )}
      
      {isHider && view && (
        <Link to={`servers/${n}/remove`}>Remove server (1 LOA)</Link>
      )}
    </>
  );
}