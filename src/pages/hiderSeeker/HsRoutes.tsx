import { Routes, Route, Outlet } from "react-router-dom";
import { HsMatchProvider } from "../../hiderSeeker/HsMatchContext";
import { HubPage } from "./HubPage";
import HiderSeekerPage from "../HiderSeekerPage";
import { HsLayout } from "./HsLayout";
import { HsResultPage } from "./HsResultPage";

export function HsMatchRoutes() {
  return (
    <HsMatchProvider>
      <Routes>
        <Route element={<HsLayout />}>
          <Route index element={<HubPage />} />
          <Route path="result" element={<HsResultPage />} />
          <Route path="classic" element={<HiderSeekerPage />} />
          <Route path="*" element={<p>No such page.</p>} />
        </Route>
      </Routes>
    </HsMatchProvider>
  );
}