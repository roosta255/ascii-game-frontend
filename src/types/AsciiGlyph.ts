// loadXp.ts — Load RexPaint .xp files at runtime
import pako from "pako";

// CP437 to Unicode translation table
/*const cp437_to_unicode: string[] = Array.from({ length: 256 }, (_, i) => {
  // Based on Wikipedia's CP437 mapping
  const mapping: { [key: number]: string } = {
    0x00: "\u0000", 0x01: "☺", 0x02: "☻", 0x03: "♥", 0x04: "♦", 0x05: "♣", 0x06: "♠", 0x07: "\u0007",
    0x08: "\b", 0x09: "\t", 0x0A: "\n", 0x0B: "\v", 0x0C: "\f", 0x0D: "\r", 0x0E: "\u000E", 0x0F: "\u000F",
    // ... (Add the rest as needed)
  };
  return mapping[i] ?? String.fromCharCode(i);
});*/

const cp437_to_unicode = [
    "\u0000", "\u263A", "\u263B", "\u2665", "\u2666", "\u2663", "\u2660", "\u2022",
    "\u25D8", "\u25CB", "\u25D9", "\u2642", "\u2640", "\u266A", "\u266B", "\u263C",
    "\u25BA", "\u25C4", "\u2195", "\u203C", "\u00B6", "\u00A7", "\u25AC", "\u21A8",
    "\u2191", "\u2193", "\u2192", "\u2190", "\u221F", "\u2194", "\u25B2", "\u25BC",
    " ", "!", "\"", "#", "$", "%", "&", "'", "(", ")", "*", "+", ",", "-", ".", "/",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", ";", "<", "=", ">", "?",
    "@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
    "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "[", "\\", "]", "^", "_",
    "`", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o",
    "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "{", "|", "}", "~", "\u2302",
    "\u00C7", "\u00FC", "\u00E9", "\u00E2", "\u00E4", "\u00E0", "\u00E5", "\u00E7",
    "\u00EA", "\u00EB", "\u00E8", "\u00EF", "\u00EE", "\u00EC", "\u00C4", "\u00C5",
    "\u00C9", "\u00E6", "\u00C6", "\u00F4", "\u00F6", "\u00F2", "\u00FB", "\u00F9",
    "\u00FF", "\u00D6", "\u00DC", "\u00A2", "\u00A3", "\u00A5", "\u20A7", "\u0192",
    "\u00E1", "\u00ED", "\u00F3", "\u00FA", "\u00F1", "\u00D1", "\u00AA", "\u00BA",
    "\u00BF", "\u2310", "\u00AC", "\u00BD", "\u00BC", "\u00A1", "\u00AB", "\u00BB",
    "\u2591", "\u2592", "\u2593", "\u2502", "\u2524", "\u2561", "\u2562", "\u2556",
    "\u2555", "\u2563", "\u2551", "\u2557", "\u255D", "\u255C", "\u255B", "\u2510",
    "\u2514", "\u2534", "\u252C", "\u251C", "\u2500", "\u253C", "\u255E", "\u255F",
    "\u255A", "\u2554", "\u2569", "\u2566", "\u2560", "\u2550", "\u256C", "\u2567",
    "\u2568", "\u2564", "\u2565", "\u2559", "\u2558", "\u2552", "\u2553", "\u256B",
    "\u256A", "\u2518", "\u250C", "\u2588", "\u2584", "\u258C", "\u2590", "\u2580",
    "\u03B1", "\u00DF", "\u0393", "\u03C0", "\u03A3", "\u03C3", "\u00B5", "\u03C4",
    "\u03A6", "\u0398", "\u03A9", "\u03B4", "\u221E", "\u03C6", "\u03B5", "\u2229",
    "\u2261", "\u00B1", "\u2265", "\u2264", "\u2320", "\u2321", "\u00F7", "\u2248",
    "\u00B0", "\u2219", "\u00B7", "\u221A", "\u207F", "\u00B2", "\u25A0", "\u00A0"
  ];
  

// The basic unit of rendering
export interface AsciiGlyph {
  char: string; // Unicode character
  // raw: number;
  fg: number;   // foreground color (raw RGB or index, TBD)
  bg: number;   // background color
  onClick?: (x: number, y: number) => void;
}

export function getColor(glyph: AsciiGlyph): number {
  // Prefer background if the character is a full block (assumed background design glyph)
  const isFullBackground = glyph.char === " ";
  return isFullBackground ? glyph.bg : glyph.fg;
}

export function swapRedBlue(color: number): number {
  const r = color & 0x0000ff;
  const g = color & 0x00ff00;
  const b = color & 0xff0000;
  return (r << 16) | g | (b >> 16)
}

export function isTransparent(glyph: AsciiGlyph): boolean {
  return (getColor(glyph) & 0xffffff) == 0xff00ff || (getColor(glyph) & 0xffffff) == 0xff00fe;
}

export async function loadXp(buffer: ArrayBuffer): Promise<AsciiGlyph[][][]> {
  const decompressed = pako.inflate(new Uint8Array(buffer));
  const data = new DataView(decompressed.buffer);

  const version = data.getInt32(0, true);
  const layerCount = data.getInt32(4, true);
  const width = data.getInt32(8, true);
  const height = data.getInt32(12, true);

  console.log("🧵 XP Metadata:", { version, layerCount, width, height });

  const layers: AsciiGlyph[][][] = [];

  let offset = 16;

  for (let z = 0; z < layerCount; z++) {
    const layer: AsciiGlyph[][] = [];

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const charCode = data.getUint32(offset, true);
        const fg = data.getInt32(offset + 4, true);
        const bg = data.getInt16(offset + 8, true);
        offset += 10;

        if (!layer[y]) layer[y] = [];
        layer[y][x] = {
          // raw: charCode & 0xff,
          char: cp437_to_unicode[charCode & 0xff] ?? "?",
          fg: swapRedBlue(fg),
          bg: swapRedBlue(bg),
        };
      }
    }

    layers.push(layer);

    console.log("🔍 Sample at", {
      "<0,0>": layer[0]?.[0],
      "<1,0>": layer[0]?.[1],
      "<0,1>": layer[1]?.[0],
      "<1,1>": layer[1]?.[1],
      "<2,91>": layer[91]?.[2],
    });

    offset += 8; // Skip 8-byte layer delimiter
  }

  return layers;
}

export function createBlankCanvas(width: number, height: number): AsciiGlyph[][] {
  const blankGlyph: AsciiGlyph = { char: " ", fg: 0, bg: 0 };
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...blankGlyph }))
  );
}
