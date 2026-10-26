import { METRIC_ORDER } from "./viewText";

// A view's servers as a table: one row per active server, one column per metric in METRIC_ORDER.
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
                <td key={metric}>{String(server.metrics[metric])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}