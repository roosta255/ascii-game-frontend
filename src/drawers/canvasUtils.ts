import { AsciiGlyph } from '../types/AsciiGlyph';

export const DEBUG_KEYFRAMES = import.meta.env.VITE_DEBUG_KEYFRAMES === 'true';

export function debugKeyframes(label: string, keyframes: any[]) {
  if (!DEBUG_KEYFRAMES) return;
  console.groupCollapsed(`[keyframes] ${label} (${keyframes.length})`);
  console.log(JSON.stringify(keyframes, null, 2));
  console.groupEnd();
}

export function writeText(
  glyphs: AsciiGlyph[][],
  x: number, y: number,
  text: string,
  fg: number, bg: number,
  onClick?: () => void,
) {
  for (let i = 0; i < text.length; i++) {
    if (glyphs[y]?.[x + i]) {
      glyphs[y][x + i] = { char: text[i], fg, bg, onClick };
    }
  }
}

export function markRegionClickable(
  glyphs: AsciiGlyph[][],
  startX: number, startY: number,
  width: number, height: number,
  onClick: () => void,
) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const gx = startX + dx;
      const gy = startY + dy;
      if (glyphs[gy]?.[gx]) {
        glyphs[gy][gx].onClick = () => onClick();
      }
    }
  }
}

export function formatTrait(name: string): string {
  return name.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
