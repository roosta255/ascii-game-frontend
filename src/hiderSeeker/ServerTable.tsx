import { METRIC_ORDER } from "./viewText";
import Sparkline from "./Sparkline";

// A view's servers as a table: one row per active server, one column per metric in METRIC_ORDER, each with its history as a sparkline.
export default function ServerTable({ servers }: { servers: any[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>server</th>
            {METRIC_ORDER.map((metric) => (
              <th key={metric}>{metric}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servers.map((server: any) => (
            <tr key={server.server_id}>
              <td>{server.server_id}</td>
              {METRIC_ORDER.map((metric) => (
                <td key={metric}>
                  {String(server.metrics[metric])}
                  {server.history && (
                    <Sparkline
                      values={server.history.map((frame: any) => frame[metric])}
                      label={`server ${server.server_id} ${metric} history`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}