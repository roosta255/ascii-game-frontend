import { eventText } from "./viewText";

// A view's public events, newest first, or "None." when there are none.
export default function EventList({ events }: { events: any[] }) {
  if (events.length === 0) {
    return <p>None.</p>;
  }
  return (
    <ul>
      {[...events].reverse().map((event: any, index: number) => (
        <li key={index}>{eventText(event)}</li>
      ))}
    </ul>
  );
}