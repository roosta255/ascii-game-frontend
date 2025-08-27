// texture.ts — Handles sprite extraction and rendering from a texture atlas
import { AsciiGlyph, getColor, isTransparent } from "../loadXp";

interface SpriteMeta {
  offset: [number, number];
  isHorizontalFlip: boolean;
  isVerticalFlip: boolean;
}

export interface TextureSpriteMeta {
  path: string;
  palettes: number;
  size: [number, number];
  stride: [number, number];
  default: [number, number];
  offset: [number, number];
  sprites: Record<string, [number, number]>;
  spritesWithHorizontalFlip: Record<string, [number, number]>;
  spritesWithVerticalFlip: Record<string, [number, number]>;
  spritesWithHorizontalAndVerticalFlip: Record<string, [number, number]>;
}

export class Texture {
  layer: AsciiGlyph[][];
  meta: TextureSpriteMeta;
  private palettes: { [key: number]: number }[] = [];
  private sprites: { [key: string]: SpriteMeta }[] = [];

  constructor(layer: AsciiGlyph[][], meta: TextureSpriteMeta) {
    this.layer = layer;
    this.meta = meta;

    for(let y = 0; y < meta.palettes; y++){

      var palette: { [key: number]: number } = {};

      // reverse the order to override on way down
      // this prioritizes lefter duplicates
      for(let x = layer[0].length - 1; x >= 0; x--) {
        const keyColor = getColor(layer[0][x]);
        const finalColor = getColor(layer[y][x]);
        palette[keyColor] = finalColor;
      }

      this.palettes[y] = palette;
    }

    for (const [key, offset] of Object.entries(meta.sprites ?? {})) {
      this.sprites[key] = { offset, isHorizontalFlip: false, isVerticalFlip: false };
    }
    for (const [key, offset] of Object.entries(meta.spritesWithHorizontalFlip ?? {})) {
      this.sprites[key] = { offset, isHorizontalFlip: true, isVerticalFlip: false };
    }
    for (const [key, offset] of Object.entries(meta.spritesWithVerticalFlip ?? {})) {
      this.sprites[key] = { offset, isHorizontalFlip: false, isVerticalFlip: true };
    }
    for (const [key, offset] of Object.entries(meta.spritesWithHorizontalAndVerticalFlip ?? {})) {
      this.sprites[key] = { offset, isHorizontalFlip: true, isVerticalFlip: true };
    }
  }

  clone(): AsciiGlyph[][] {
    return this.layer.map(row => row.map(cell => ({ ...cell })));
  }  

  draw(target: AsciiGlyph[][], spriteName: string, targetX: number, targetY: number, palette: number, onClick?: () => void): void {
    const spriteRequested = this.sprites[spriteName];

    const [width, height] = this.meta.size;
    const [strideX, strideY] = this.meta.stride;
    const [offsetX, offsetY] = this.meta.offset;
    const [cellX, cellY] = !spriteRequested ? this.meta.default : spriteRequested.offset;
    const startX = (offsetX + cellX * strideX);
    const startY = (offsetY + cellY * strideY);

    if (!this.palettes[palette]) {
      console.warn(`⚠️ Palette ${palette} not found for draw()`);
      palette = 0;
    }

    // console.log(`Texture.get(${spriteName}): <${cellX}, ${cellY}> -> <${startX}, ${startY}>`);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const before = this.layer[startY + y]?.[startX + x] ?? { char: "?", fg: 1, bg: 0 };
        if (isTransparent(before)) {
          continue;
        }
        const glyph = {
          bg: this.palettes[palette][before.bg] ?? before.bg,
          fg: this.palettes[palette][before.fg] ?? before.fg,
          char: before.char,
          onClick,
        };
        if (isTransparent(glyph)) {
          continue;
        }
        if (target[targetY + y] && target[targetY + y][targetX + x]) {
          target[targetY + y][targetX + x] = glyph;
        }
      }
    }
  }

}
