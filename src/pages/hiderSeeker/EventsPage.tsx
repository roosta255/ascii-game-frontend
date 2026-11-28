import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { eventDescription } from "../../hiderSeeker/viewText";
import { Link } from "react-router-dom";

function EventsPageInner() {
  const { matchId, view, publicView } = useHsMatch();
  
  if (!matchId) {
    return null;
  }
  
  // Use view.events for hiders, publicView.events for spectators
  const events = (view?.events || publicView?.events) ?? [];
  
  if (events.length === 0) {
    return <p>None.</p>;
  }
  
  // Sort events newest first (higher tick values first)
  const sortedEvents = [...events].sort((a, b) => b.tick - a.tick);
  
  return (
    <table>
      <tbody>
        {sortedEvents.map(event => (
          <tr key={event.tick}>
            <td>{event.tick}</td>
            <td>
              {event.server_id !== undefined && event.server_id !== null ? (
                <Link to={`/hs/${matchId}/servers/${event.server_id}`}>
                  {eventDescription(event)}
                </Link>
              ) : (
                eventDescription(event)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EventsPage() {
  return <HiderOnly><EventsPageInner /></HiderOnly>;
}