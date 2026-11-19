import { METRIC_ORDER } from "./viewText";
import Sparkline from "./Sparkline";

// One glyph per rack light, in order: heat, errors, seeker connected. A lit light shows its letter, an unlit one "-".
export function lightsText(lights: any): string {
  if (!lights) return "";
  return `${lights.heat ? "H" : "-"}${lights.errors ? "E" : "-"}${lights.seeker_connected ? "S" : "-"}`;
}

// A view's servers as a table: one row per active server, one column per metric in METRIC_ORDER, each with its history and current value as a sparkline, then the server's lights.
// A hider view sends metrics: null for servers the hider is not connected to; those rows show "not connected" across the metric columns.
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
            <th>lights</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server: any) => (
            <tr key={server.server_id}>
              <td>{server.server_id}</td>
              {server.metrics ? (
                METRIC_ORDER.map((metric) => (
                  <td key={metric}>
                    {String(server.metrics[metric])}
                    {server.history && (
                      <Sparkline
                        values={[...server.history.map((frame: any) => frame[metric]), server.metrics[metric]]}
                        label={`server ${server.server_id} ${metric} history`}
                      />
                    )}
                  </td>
                ))
              ) : (
                <td colSpan={METRIC_ORDER.length}>not connected</td>
              )}
              <td
                aria-label={`server ${server.server_id} lights`}
                title="H heat high, E errors high, S seeker connected"
              >
                {lightsText(server.lights)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
