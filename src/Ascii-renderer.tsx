
// ASCII rendering system with framebuffer-style renderer + clickable support
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

// --- Types ---

export type AsciiGlyph = {
  char: string;
  fg: number;
  bg: number;
};

export type Palette = {
  [paletteId: string]: string[]; // 256 color strings per palette
};

// Framebuffer is a 2D grid of AsciiGlyphs and optional click handlers
export class AsciiBuffer {
  width: number;
  height: number;
  grid: AsciiGlyph[][];
  clickMap: (null | (() => void))[][];

  constructor(width: number, height: number, fill: AsciiGlyph = { char: " ", fg: 7, bg: 0 }) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ...fill })));
    this.clickMap = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
  }

  drawGlyph(x: number, y: number, glyph: AsciiGlyph, onClick?: () => void) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = glyph;
      this.clickMap[y][x] = onClick ?? null;
    }
  }

  drawBlock(
    x: number,
    y: number,
    block: AsciiGlyph[][],
    clickFn?: (dx: number, dy: number) => () => void
  ) {
    for (let row = 0; row < block.length; row++) {
      for (let col = 0; col < block[row].length; col++) {
        const onClick = clickFn ? clickFn(col, row) : undefined;
        this.drawGlyph(x + col, y + row, block[row][col], onClick);
      }
    }
  }
}

// --- Palette Context ---
const PalettesContext = createContext<Palette>({});
export function usePalettes() {
  return useContext(PalettesContext);
}

// --- Framebuffer Renderer ---

export function AsciiScene({
  width,
  height,
  paletteId,
  render,
}: {
  width: number;
  height: number;
  paletteId: string;
  render: (buffer: AsciiBuffer, now: number) => void;
}) {
  const [now, setNow] = useState(performance.now());
  const palettes = usePalettes();
  const palette = palettes[paletteId];

  useEffect(() => {
    const loop = () => {
      setNow(performance.now());
      requestAnimationFrame(loop);
    };
    loop();
  }, []);

  const buffer = new AsciiBuffer(width, height);
  render(buffer, now);

  return (
    <pre
      style={{
        fontFamily: "monospace",
        lineHeight: "1em",
        backgroundColor: palette?.[0] || "#000",
        color: palette?.[7] || "#ccc",
      }}
    >
      {buffer.grid.map((row, y) => (
        <div key={y}>
          {row.map((glyph, x) => (
            <span
              key={x}
              onClick={buffer.clickMap[y][x] || undefined}
              style={{
                color: palette?.[glyph.fg] || "#ccc",
                backgroundColor: palette?.[glyph.bg] || "#000",
                cursor: buffer.clickMap[y][x] ? "pointer" : "default",
              }}
            >
              {glyph.char}
            </span>
          ))}
        </div>
      ))}
    </pre>
  );
}

// --- Provider ---
export function AsciiRendererProvider({
  palettes,
  children,
}: {
  palettes: Palette;
  children: React.ReactNode;
}) {
  return <PalettesContext.Provider value={palettes}>{children}</PalettesContext.Provider>;
}
