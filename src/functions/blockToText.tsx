
import { AsciiGlyph, isTransparent } from "../types/AsciiGlyph";

function intToCssColor(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

export function blockToText(block: AsciiGlyph[][]): JSX.Element {
  return (
    <>
      {block.map((row, y) => (
        <div key={y} style={{ lineHeight: 1, whiteSpace: "pre" }}>
          {row.map((glyph, x) => (
            <span
              key={x}
              onClick={() => glyph.onClick?.(x, y)}
              style={{
                color: isTransparent(glyph) ? "transparent" : intToCssColor(glyph.fg),
                backgroundColor: (glyph.bg & 0xffffff) === 0xff00ff ? "transparent" : intToCssColor(glyph.bg),
                cursor: glyph.onClick ? "pointer" : "default",
              }}
            >
              {glyph.char}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}
