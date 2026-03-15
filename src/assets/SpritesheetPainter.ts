// SpritesheetPainter.ts — Renders animation frames from a REXPaint spritesheet.
//
// Each frame cell can contain:
//   [a-t] → replace with the glyph at that local position in the "before" icon sprite
//   [A-T] → replace with the glyph at that local position in the "after" icon sprite
//   anything else → render as-is from the spritesheet, using the spritesheet palette
//
// Icon positions are 1D indices into a row-major 5x4 grid:
//   a/A = (0,0), b/B = (1,0), ..., e/E = (4,0), f/F = (0,1), ..., t/T = (4,3)

import { AsciiGlyph, getColor, isTransparent, loadXp } from "../types/AsciiGlyph";

export interface SpritesheetAnimDef {
  start: [number, number];
  length: number;
  palette: number[];
}

export interface SpritesheetMeta {
  path: string;
  palettes: number;
  size: [number, number];
  stride: [number, number];
  "grid-offset": [number, number];
  "draw-offset": [number, number];
  default: [number, number];
  spritesheet: Record<string, SpritesheetAnimDef>;
}

const ICON_WIDTH = 5;

export class SpritesheetPainter {
  layer: AsciiGlyph[][];
  meta: SpritesheetMeta;
  private palettes: { [key: number]: number }[] = [];

  constructor(layer: AsciiGlyph[][], meta: SpritesheetMeta) {
    this.layer = layer;
    this.meta = meta;

    // Build palettes the same way Texture does: row 0 is the key row,
    // row y maps each key color to its destination color for palette index y.
    for (let y = 0; y < meta.palettes; y++) {
      const palette: { [key: number]: number } = {};
      for (let x = layer[0].length - 1; x >= 0; x--) {
        const keyColor = getColor(layer[0][x]);
        const finalColor = getColor(layer[y][x]);
        palette[keyColor] = finalColor;
      }
      this.palettes[y] = palette;
    }
  }

  static async load(metaUrl: string, xpBaseUrl: string = ""): Promise<SpritesheetPainter> {
    const meta: SpritesheetMeta = await fetch(metaUrl).then(r => r.json());
    const buffer = await fetch(xpBaseUrl + meta.path).then(r => r.arrayBuffer());
    const layers = await loadXp(buffer);
    return new SpritesheetPainter(layers[0], meta);
  }

  // Renders one frame of a named animation onto the target glyph grid.
  //
  //   animName      — key in meta.spritesheet (e.g. "CRUSH")
  //   frameIndex    — 0-based frame; clamped to [0, length-1]
  //   beforeGlyphs  — pre-rendered buffer for [a-t] cells (the "before" icon); null = transparent
  //   afterGlyphs   — pre-rendered buffer for [A-T] cells (the "after" icon); null = transparent
  //   targetX/Y     — draw-offset-relative position of the animation on screen
  //   animPalette   — palette index applied to the spritesheet's own particle/effect cells
  drawFrame(
    target: AsciiGlyph[][],
    animName: string,
    frameIndex: number,
    beforeGlyphs: AsciiGlyph[][] | null,
    afterGlyphs: AsciiGlyph[][] | null,
    targetX: number,
    targetY: number,
    animPalette: number,
  ): void {
    const animDef = this.meta.spritesheet[animName];
    if (!animDef) {
      console.warn(`SpritesheetPainter: animation "${animName}" not found`);
      return;
    }

    const clampedFrame = Math.max(0, Math.min(frameIndex, animDef.length - 1));

    const [gridOffsetX, gridOffsetY] = this.meta["grid-offset"];
    const [strideX, strideY] = this.meta.stride;
    const [width, height] = this.meta.size;
    const [drawOffsetX, drawOffsetY] = this.meta["draw-offset"];

    // Frame grid position: start.x + frame index, start.y (frames go rightward)
    const frameGridX = animDef.start[0] + clampedFrame;
    const frameGridY = animDef.start[1];
    const srcX = gridOffsetX + frameGridX * strideX;
    const srcY = gridOffsetY + frameGridY * strideY;

    // Draw the animation frame centered on the icon position via draw-offset.
    const destX = targetX - drawOffsetX;
    const destY = targetY - drawOffsetY;

    const pal = this.palettes[animPalette] ? animPalette : 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = this.layer[srcY + y]?.[srcX + x];
        if (!cell || isTransparent(cell)) continue;

        const charCode = cell.char.charCodeAt(0);
        let glyph: AsciiGlyph | null = null;

        if (charCode >= 97 && charCode <= 116) {
          // 'a'–'t': sample the pre-rendered before buffer at this local icon position
          const idx = charCode - 97; // 0–19
          const g = beforeGlyphs?.[Math.floor(idx / ICON_WIDTH)]?.[idx % ICON_WIDTH];
          glyph = (g && !isTransparent(g)) ? g : null;
        } else if (charCode >= 65 && charCode <= 84) {
          // 'A'–'T': sample the pre-rendered after buffer at this local icon position
          const idx = charCode - 65; // 0–19
          const g = afterGlyphs?.[Math.floor(idx / ICON_WIDTH)]?.[idx % ICON_WIDTH];
          glyph = (g && !isTransparent(g)) ? g : null;
        } else {
          // Particle / effect cell — render as-is with the spritesheet palette
          glyph = {
            bg: this.palettes[pal][cell.bg] ?? cell.bg,
            fg: this.palettes[pal][cell.fg] ?? cell.fg,
            char: cell.char,
          };
        }

        if (!glyph || isTransparent(glyph)) continue;

        const tx = destX + x;
        const ty = destY + y;
        if (target[ty]?.[tx]) {
          target[ty][tx] = glyph;
        }
      }
    }
  }
}
