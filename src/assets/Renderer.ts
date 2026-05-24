// src/systems/RendererSystem.ts — Refactored to remove if-chains using function mapping for TypeScript polymorphism

import { AsciiGlyph } from "../types/AsciiGlyph";
import { DrawerProps } from "../types/DrawerProps";

export interface DirectionalIconRendererEntry {
    sprite: string;
    palette: number;
}

export type Renderer =
    | { type: "Unrendered" }
    | { type: "BackgroundRenderer"; sprite: string; palette: number }
    | { type: "CharacterRenderer"; sprite: string; palette: number; eyes?: number }
    | { type: "DirectionalIconRenderer"; directions: DirectionalIconRendererEntry[] }
    | { type: "DoorwayRenderer"; sprite: string }
    | { type: "SpriteRenderer"; sprite: string; palette: number }
    | { type: "AnimatedSpriteRenderer"; animation: string; looping: boolean; palette: number }
    | { type: "EyePaletteRenderer"; palette: number };

export interface RenderContext {
    globals: DrawerProps;
    locals: {
        coords: [number, number];
        direction?: number;
        onClick?: () => void;
        room?: any;
        /** Overrides the renderer's own eyes palette index for IS_EYE_COLOR status effects. */
        eyePaletteOverride?: number;
        /** Current server-synced animation time (ms). Required for AnimatedSpriteRenderer. */
        animationTime?: number;
        /** Progress [0,1] through the current keyframe. Used by non-looping AnimatedSpriteRenderer. */
        animationProgress?: number;
        /** Pre-rendered icon buffer for [a-t] substitution cells in transition/glyphing animations. */
        beforeGlyphs?: AsciiGlyph[][] | null;
        /** Pre-rendered icon buffer for [A-T] substitution cells in transition/glyphing animations. */
        afterGlyphs?: AsciiGlyph[][] | null;
    };
}

type RendererHandler = (renderer: Renderer, ctx: RenderContext) => void;

const ANIM_FRAME_DURATION_MS = 200;

const rendererHandlers: Record<string, RendererHandler> = {
    "Unrendered": () => {},

    "DoorRenderer": (renderer, ctx) => {
        if (ctx.locals.direction == null) {
            console.warn("⚠️ Direction not provided for DoorRenderer");
            return;
        }
        const entry = (renderer as any).directions[ctx.locals.direction];
        ctx.globals.textures.icons.draw(ctx.globals.glyphs, entry.sprite, ctx.locals.coords[0], ctx.locals.coords[1], entry.palette, ctx.locals.onClick);
    },

    "CharacterRenderer": (renderer, ctx) => {
        const r = renderer as { type: "CharacterRenderer"; sprite: string; palette: number; eyes?: number };
        const eyePalette = ctx.locals.eyePaletteOverride ?? r.eyes;
        ctx.globals.textures.icons.draw(ctx.globals.glyphs, r.sprite, ctx.locals.coords[0], ctx.locals.coords[1], r.palette, ctx.locals.onClick, eyePalette);
    },

    "SpriteRenderer": (renderer, ctx) => {
        const r = renderer as any;
        ctx.globals.textures.icons.draw(ctx.globals.glyphs, r.sprite, ctx.locals.coords[0], ctx.locals.coords[1], r.palette, ctx.locals.onClick);
    },

    "BackgroundRenderer": (renderer, ctx) => {
        const r = renderer as any;
        // r.sprite = "RECT_4_x_5_BACKGROUND";
        r.palette = 16;
        ctx.globals.textures.rooms.draw(ctx.globals.glyphs, r.sprite, ctx.locals.coords[0], ctx.locals.coords[1], r.palette, ctx.locals.onClick);
    },

    "DoorwayRenderer": (renderer, ctx) => {
        const entry = renderer as any;
        const DOOR_PALETTE_OFFSET = 1;
        const room = ctx.locals.room;
        const doorPalette = DOOR_PALETTE_OFFSET +
            (room.walls[0].isDoorway ? 1 : 0) +
            (room.walls[1].isDoorway ? 2 : 0) +
            (room.walls[2].isDoorway ? 4 : 0) +
            (room.walls[3].isDoorway ? 8 : 0);

        ctx.globals.textures.rooms.draw(ctx.globals.glyphs, entry.sprite, ctx.locals.coords[0], ctx.locals.coords[1], doorPalette, ctx.locals.onClick);
    },

    "AnimatedSpriteRenderer": (renderer, ctx) => {
        const r = renderer as { type: "AnimatedSpriteRenderer"; animation: string; looping: boolean; palette: number };
        const sheet = ctx.globals.textures.animationSheet;
        if (!sheet) return;
        const animDef = sheet.meta.spritesheet[r.animation];
        if (!animDef) return;

        const frameCount = animDef.length;
        const palettes = animDef.palette.length > 0 ? animDef.palette : [r.palette];

        let frameIndex: number;
        let animPalette: number;
        if (r.looping) {
            const t = ctx.locals.animationTime ?? 0;
            frameIndex = Math.floor((t % (frameCount * ANIM_FRAME_DURATION_MS)) / ANIM_FRAME_DURATION_MS);
            animPalette = palettes[0] ?? r.palette;
        } else {
            const progress = ctx.locals.animationProgress ?? 0;
            frameIndex = Math.min(Math.floor(progress * frameCount), frameCount - 1);
            animPalette = palettes[Math.min(Math.floor(progress * palettes.length), palettes.length - 1)] ?? r.palette;
        }

        const [cx, cy] = ctx.locals.coords;
        sheet.drawFrame(
            ctx.globals.glyphs,
            r.animation,
            frameIndex,
            ctx.locals.beforeGlyphs ?? null,
            ctx.locals.afterGlyphs ?? null,
            cx,
            cy,
            animPalette,
        );
    },

    // Carries eye-palette information only — no glyph output.
    // The palette value is read directly from the renderer type by callers.
    "EyePaletteRenderer": () => {},
};

export function getRendererPalette(renderer: Renderer): number | null {
    switch (renderer.type) {
        case "CharacterRenderer":
        case "SpriteRenderer":
        case "AnimatedSpriteRenderer":
        case "EyePaletteRenderer":
            return renderer.palette;
        default:
            return null;
    }
}

export function render(renderer: Renderer, ctx: RenderContext): void {
    const x = ctx.locals.coords[0];
    const y = ctx.locals.coords[1];
    if (typeof x !== "number" || Number.isNaN(x) || typeof y !== "number" || Number.isNaN(y)) {
        console.error("Invalid coordinates:", renderer, ctx);
    }
    const handler = rendererHandlers[renderer.type];
    if (!handler) {
        console.warn(`⚠️ No handler found for renderer type: ${renderer.type}`);
        return;
    }
    handler(renderer, ctx);
}

export function parseRenderer(raw: any): Renderer {
    if (!raw || !raw.renderer || !raw.renderer.type) {
        return { type: "Unrendered" };
    }

    switch (raw.renderer.type) {
        case "Unrendered":
            return { type: "Unrendered" };
        case "BackgroundRenderer":
            return { type: "BackgroundRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        case "DoorRenderer":
            return { type: "DoorRenderer", directions: raw.renderer.directions };
        case "DoorwayRenderer":
            return { type: "DoorwayRenderer", sprite: raw.renderer.sprite };
        case "CharacterRenderer":
            return { type: "CharacterRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette, eyes: raw.renderer.eyes };
        case "SpriteRenderer":
            return { type: "SpriteRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        case "AnimatedSpriteRenderer":
            return { type: "AnimatedSpriteRenderer", animation: raw.renderer.animation, looping: raw.renderer.looping ?? false, palette: raw.renderer.palette ?? 0 };
        case "EyePaletteRenderer":
            return { type: "EyePaletteRenderer", palette: raw.renderer.palette };
        default:
            console.warn(`⚠️ Unknown renderer type: ${raw.renderer.type}, defaulting to Unrendered`);
            return { type: "Unrendered" };
    }
}
