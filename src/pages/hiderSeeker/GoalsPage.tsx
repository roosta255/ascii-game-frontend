import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { requirementText, isReady } from "../../hiderSeeker/goals";
import { Link } from "react-router-dom";

export function GoalsPage() {
  const { matchId, view, publicView } = useHsMatch();
  
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
  
  const goals = view.goals.slice(0, 16); // At most 16 goals
  
  return (
    <HiderOnly>
      <p>Team reward {view.team_reward} / {view.reward_target}</p>
      
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Reward</th>
            <th>Requirements</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {goals.map((goal: any) => (
            <tr key={goal.goal_id}>
              <td><Link to={`/hs/${matchId}/goals/${goal.goal_id}`}>{goal.goal_id}</Link></td>
              <td>{goal.status}</td>
              <td>{goal.reward_amount}</td>
              <td>
                {goal.requirements.map((req: any, index: number) => (
                  <span key={index}>
                    {index > 0 && '; '}
                    {requirementText(req)}
                  </span>
                ))}
              </td>
              <td>{isReady(view, goal) && 'READY'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HiderOnly>
  );
}