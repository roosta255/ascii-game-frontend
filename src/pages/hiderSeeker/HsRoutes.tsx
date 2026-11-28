import { Routes, Route, Outlet, Link } from "react-router-dom";
import { HsMatchProvider } from "../../hiderSeeker/HsMatchContext";
import { HubPage } from "./HubPage";
import HiderSeekerPage from "../HiderSeekerPage";
import { HsLayout } from "./HsLayout";
import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { RackPage } from "./RackPage";
import { ServerPage } from "./ServerPage";
import { RemoveServerPage } from "./RemoveServerPage";

function HsResultRoute() {
  const { resultLines, resultFrom, matchId } = useHsMatch();
  
  if (resultLines.length > 0) {
    return (
      <>
        <ul>
          {resultLines.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
        <br />
        <Link to={resultFrom || `/hs/${matchId}`}>Back</Link>
      </>
    );
  } else {
    return (
      <>
        <p>No move yet.</p>
        <br />
        <Link to={resultFrom || `/hs/${matchId}`}>Back</Link>
      </>
    );
  }
}

export function HsMatchRoutes() {
  return (
    <Routes>
      <Route element={<HsLayout />}>
        <Route index element={<HubPage />} />
        <Route path="rack" element={<RackPage />} />
        <Route path="servers/:serverId" element={<ServerPage />} />
        <Route path="servers/:serverId/remove" element={<RemoveServerPage />} />
        <Route path="result" element={<HsResultRoute />} />
        <Route path="classic" element={<HiderSeekerPage />} />
        <Route path="*" element={<p>No such page.</p>} />
      </Route>
    </Routes>
  );
}