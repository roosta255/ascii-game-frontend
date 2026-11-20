import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { Outlet, Link } from "react-router-dom";
import { hiderStatusLine, spectatorStatusLine } from "../../hiderSeeker/statusLine";
import { HsMenu } from "../../hiderSeeker/HsMenu";
import { HsLobby } from "./HsLobby";
import { HsMatchProvider } from "../../hiderSeeker/HsMatchContext";

export function HsLayout() {
  // This component now wraps its children in HsMatchProvider
  return (
    <HsMatchProvider>
      <LayoutContent />
    </HsMatchProvider>
  );
}

function LayoutContent() {
  const { match, mode, error, view, publicView } = useHsMatch();
  
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
  
  // Select the correct view based on mode
  const selectedView = mode === "PLAY" ? view : publicView;
  
  // If the selected view is null, render loading placeholder
  if (selectedView === null) {
    return <div style={{ padding: 16 }}>Loading...</div>;
  }
  
  // Render status line based on mode and view
  const statusLine = mode === "PLAY" 
    ? hiderStatusLine(selectedView) 
    : spectatorStatusLine(selectedView);
  
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