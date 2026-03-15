import { AsciiGlyph, createBlankCanvas } from "./AsciiGlyph";
import { Painter } from "../assets/Painter";
import { Texture } from "../assets/Texture";
import { SpritesheetPainter } from "../assets/SpritesheetPainter";

interface TextureProps {
    rooms: Texture;
    icons: Texture;
    minimap: Texture;
    animationSheet?: SpritesheetPainter;
};

interface PainterProps {
    doors: Painter;
    items: Painter;
    roles: Painter;
    locks: Painter;
    chestLocks: Painter;
    backgrounds: Painter;
    doorways: Painter;
};

export interface DrawerProps {
    glyphs: AsciiGlyph[][];
    textures: TextureProps;
    painters: PainterProps;
};

export function rebuildGlyphs(source: DrawerProps, width: number, height: number): DrawerProps {
    return {
        textures: source.textures,
        painters: source.painters,
        glyphs: createBlankCanvas(width, height),
    };
}
