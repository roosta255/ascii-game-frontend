import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { Link } from "react-router-dom";
import { HiderOnly } from "./HsLayout";

export function TeamPage() {
  const { view, publicView, mode } = useHsMatch();
  
  // For a hider, we show team members (excluding self)
  // For a spectator, we show all hiders
  const hiders = mode === "PLAY" ? view?.team : publicView?.hiders;
  
  if (!hiders) {
    return null;
  }
  
  return (
    <HiderOnly>
      <table>
        <thead>
          <tr>
            <th>Hider</th>
            <th>Account</th>
            <th>Status</th>
            <th>Server</th>
          </tr>
        </thead>
        <tbody>
          {hiders.map((hider: { hider_id: number; account?: string; status: string; server_id: number | null }, index: number) => (
            <tr key={index}>
              <td>T{hider.hider_id}</td>
              <td>{hider.account || "open"}</td>
              <td>{hider.status}</td>
              <td>
                {hider.server_id !== null ? (
                  <Link to={`/hs/m1/servers/${hider.server_id}`}>server {hider.server_id}</Link>
                ) : (
                  "disconnected"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HiderOnly>
  );
}