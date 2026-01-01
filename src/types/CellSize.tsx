export interface CellSize {
  width: number;
  height: number;
}

export function measureCellSize(scene: HTMLElement): CellSize {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.visibility = "hidden";
  span.style.position = "absolute";

  scene.appendChild(span);
  const rect = span.getBoundingClientRect();
  scene.removeChild(span);

  return {
    width: rect.width,
    height: rect.height,
  };
}
