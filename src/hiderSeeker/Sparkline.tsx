import { sparklinePoints } from "./sparkline";

const WIDTH = 60;
const HEIGHT = 20;

// A small line chart of values, oldest on the left, labelled for screen readers.
export default function Sparkline({ values, label }: { values: number[]; label: string }) {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`${label}: ${values.join(" ")}`}
      style={{ display: "block" }}
    >
      <polyline
        points={sparklinePoints(values, WIDTH, HEIGHT)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}