import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { matchSummary } from "../../hiderSeeker/viewText";

export function HubPage() {
  const { match, view, mode, publicView } = useHsMatch();
  
  if (!match) {
    return null;
  }
  
  // Select the correct view based on mode
  const summaryView = mode === "PLAY" ? view : publicView;
  
  return (
    <div>
      <p>{matchSummary(summaryView)}</p>
      {match.winner && <p>Winner: {match.winner}</p>}
      
      {mode === "PLAY" && (
        <p>Team reward {view.team_reward} / {view.reward_target}. Team connections left: {view.team_connections}.</p>
      )}
    </div>
  );
}