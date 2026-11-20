import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { Outlet, Link } from "react-router-dom";
import { hiderStatusLine, spectatorStatusLine } from "../../hiderSeeker/statusLine";
import { HsMenu } from "../../hiderSeeker/HsMenu";
import { HsLobby } from "./HsLobby";

export function HsLayout() {
  const { match, mode, error, view } = useHsMatch();
  
  if (match === null) {
    return <div style={{ padding: 16 }}>{error ?? "Loading..."}</div>;
  }
  
  if (mode === "LOBBY") {
    return (
      <div style={{ padding: 16 }}>
        <HsLobby />
      </div>
    );
  }
  
  const statusLine = mode === "PLAY" 
    ? hiderStatusLine(view) 
    : spectatorStatusLine(view);
  
  return (
    <div style={{ padding: 16 }}>
      <h2>Hider-Seeker</h2>
      <p>{statusLine}</p>
      <Outlet />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <HsMenu />
    </div>
  );
}

export function HiderOnly({ children }: { children: React.ReactNode }) {
  const { mode } = useHsMatch();
  
  if (mode === "PLAY") {
    return <>{children}</>;
  }
  
  return <p>Only hiders in this match can see this page.</p>;
}