// SVG polyline points for a sparkline: one point per value, left to right,
// spread evenly across width. The y scale runs from 0 at the bottom to the
// largest value (at least 1) at the top. y is rounded to one decimal.
export function sparklinePoints(values: number[], width: number, height: number): string {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = Math.round(index * step * 10) / 10;
      const y = Math.round((height - (value * height) / max) * 10) / 10;
      return `${x},${y}`;
    })
    .join(" ");
}