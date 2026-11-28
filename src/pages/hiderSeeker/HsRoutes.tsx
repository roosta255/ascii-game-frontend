import { Routes, Route, Link } from "react-router-dom";
import { HsMatchProvider } from "../../hiderSeeker/HsMatchContext";
import { HubPage } from "./HubPage";
import HiderSeekerPage from "../HiderSeekerPage";
import { HsLayout } from "./HsLayout";
import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { RackPage } from "./RackPage";
import { ServerPage } from "./ServerPage";
import { RemoveServerPage } from "./RemoveServerPage";
import { ServerActionsPage } from "./ServerActionsPage";
import { ResultPage } from "./ResultPage";
import { PassPage } from "./PassPage";
import { QueuePage } from "./QueuePage";
import { GoalsPage } from "./GoalsPage";
import { GoalPage } from "./GoalPage";

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
        <Route path="servers/:serverId/actions" element={<ServerActionsPage />} />
        <Route path="pass" element={<PassPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="goals/:goalId" element={<GoalPage />} />
        <Route path="result" element={<HsResultRoute />} />
        <Route path="classic" element={<HiderSeekerPage />} />
        <Route path="*" element={<p>No such page.</p>} />
      </Route>
    </Routes>
  );
}