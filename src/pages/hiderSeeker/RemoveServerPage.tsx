import { Link, useParams } from "react-router-dom";
import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { occupancy, relocationTarget, goalsNeedingServer } from "../../hiderSeeker/rack";
import { previewMove } from "../../hiderSeeker/turnPreview";
import { moveBlockedReason } from "../../hiderSeeker/statusLine";

function RemoveServer() {
  const { view, run, client } = useHsMatch();
  const params = useParams<{ serverId: string }>();
  const n = parseInt(params.serverId ?? "", 10);
  
  if (!view.servers.some((s: any) => s.server_id === n)) {
    return <p>Server {n} is not active.</p>;
  }
  
  const goals = goalsNeedingServer(view, n);
  const blocked = moveBlockedReason(view);
  const send = (playMode: "PLAY" | "QUEUE") =>
    run(() => client.submitMove(view.match_id, view.self.account, view.revision, playMode,
      { type: "REMOVE_SERVER", server_id: n }), `servers/${n}/remove`);
  
  return (
    <div>
      <h2>Remove server {n}?</h2>
      <p>Costs 1 LOA (you have {view.self.loa}).</p>
      {occupancy(view, n) !== "" && <p>Everyone on it is moved to server {relocationTarget(view, n)}.</p>}
      {goals.length > 0 && <p>Goals {goals.join(", ")} are cancelled.</p>}
      <p>{previewMove(view, "REMOVE_SERVER", "PLAY").summary}</p>
      {blocked ? <p>{blocked}</p> : (
        <>
          <button disabled={view.self.loa < 1} onClick={() => send("PLAY")}>Play</button>
          <button disabled={view.self.loa < 1} onClick={() => send("QUEUE")}>Queue</button>
        </>
      )}
      <Link to={`/hs/${view.match_id}/servers/${n}`}>Back</Link>
    </div>
  );
}

export function RemoveServerPage() {
  return <HiderOnly><RemoveServer /></HiderOnly>;
}