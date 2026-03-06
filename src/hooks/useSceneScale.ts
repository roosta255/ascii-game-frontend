import { useEffect, useState, RefObject } from "react";

// The dungeon background is always 39 glyphs wide even on an 80-column canvas.
// On mobile we scale down so those 39 glyphs fill the viewport width exactly.
const ROOM_GLYPHS = 39;
const CANVAS_GLYPHS = 80;
const ROOM_FRACTION = ROOM_GLYPHS / CANVAS_GLYPHS; // 0.4875

export function useSceneScale(sceneRef: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function recalculate() {
      if (!sceneRef.current) return;
      const naturalWidth = sceneRef.current.scrollWidth;
      if (!naturalWidth) return;
      const roomWidth = naturalWidth * ROOM_FRACTION;
      // Cap at 1 so desktop never gets upscaled.
      setScale(Math.min(1, window.innerWidth / roomWidth));
    }

    recalculate();
    window.addEventListener("resize", recalculate);
    return () => window.removeEventListener("resize", recalculate);
  }, [sceneRef]);

  return scale;
}
