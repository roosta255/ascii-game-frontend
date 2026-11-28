import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { requirementText, requirementStatus } from "../../hiderSeeker/goals";
import { useParams, Link } from "react-router-dom";

export function GoalPage() {
  const { matchId, view, publicView } = useHsMatch();
  const { goalId } = useParams();
  
  if (!matchId) {
    return null;
  }
  
  if (publicView) {
    return (
      <div>
        <p>Only hiders in this match can see this page.</p>
      </div>
    );
  }
  
  if (!view) {
    return <p>Loading...</p>;
  }
  
  const goalIdNum = parseInt(goalId || '', 10);
  const goal = view.goals.find((g: any) => g.goal_id === goalIdNum);
  
  if (!goal) {
    return <p>Goal {goalId} not found.</p>;
  }
  
  const requirements = goal.requirements.slice(0, 16); // At most 16 requirements
  
  return (
    <HiderOnly>
      <p>Goal ID: {goal.goal_id}</p>
      <p>Status: {goal.status}</p>
      <p>Reward: {goal.reward_amount}</p>
      
      {view.completable_goal_id !== null ? (
        <p>Pay goal now completes goal {view.completable_goal_id}</p>
      ) : (
        <p>No goal is ready</p>
      )}
      
      <table>
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((req: any, index: number) => (
            <tr key={index}>
              <td>
                {req.type === 'SERVER_METRIC_THRESHOLD' ? (
                  <Link to={`/hs/${matchId}/servers/${req.server_id}`}>
                    {requirementText(req)}
                  </Link>
                ) : (
                  requirementText(req)
                )}
              </td>
              <td>{requirementStatus(view, req)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HiderOnly>
  );
}