import { useHsMatch } from "../../hiderSeeker/HsMatchContext";
import { HiderOnly } from "./HsLayout";
import { resourceRows } from "../../hiderSeeker/playerResources";

export function PlayerPage() {
  const { view, mode } = useHsMatch();
  
  if (!view || mode !== "PLAY") {
    return null;
  }
  
  return (
    <HiderOnly>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Value</th>
            <th>Limit or regeneration</th>
            <th>What spends it</th>
          </tr>
        </thead>
        <tbody>
          {resourceRows(view).map((row, index) => (
            <tr key={index}>
              <td>{row.name}</td>
              <td>{row.value}</td>
              <td>{row.limit}</td>
              <td>{row.spentBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </HiderOnly>
  );
}