// src/systems/RendererSystem.ts — Refactored to remove if-chains using function mapping for TypeScript polymorphism

import { Texture } from "./Texture";
import { AsciiGlyph } from "../loadXp";

export interface DirectionalIconRendererEntry {
    sprite: string;
    palette: number;
}

export type Renderer =
    | { type: "Unrendered" }
    | { type: "DirectionalIconRenderer"; directions: DirectionalIconRendererEntry[] }
    | { type: "CharacterRenderer"; sprite: string; palette: number }
    | { type: "SpriteRenderer"; sprite: string; palette: number };

export interface RenderContext {
    globals: {
        textures: {
            icons: Texture;
            rooms: Texture;
        };
        glyphs: AsciiGlyph[][];
    };
    locals: {
        coords: [number, number];
        direction?: number;
        onClick?: () => void;
    };
}

type RendererHandler = (renderer: Renderer, ctx: RenderContext) => void;

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
        const r = renderer as any;
        // console.log("Rendering: ", r, ctx);
        ctx.globals.textures.icons.draw(ctx.globals.glyphs, r.sprite, ctx.locals.coords[0], ctx.locals.coords[1], r.palette, ctx.locals.onClick);
    },

    "SpriteRenderer": (renderer, ctx) => {
        const r = renderer as any;
        ctx.globals.textures.icons.draw(ctx.globals.glyphs, r.sprite, ctx.locals.coords[0], ctx.locals.coords[1], r.palette, ctx.locals.onClick);
    }
};

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
        case "DoorRenderer":
            return { type: "DoorRenderer", directions: raw.renderer.directions };
        case "CharacterRenderer":
            return { type: "CharacterRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        case "SpriteRenderer":
            return { type: "SpriteRenderer", sprite: raw.renderer.layerName, palette: raw.renderer.palette };
        default:
            console.warn(`⚠️ Unknown renderer type: ${raw.renderer.type}, defaulting to Unrendered`);
            return { type: "Unrendered" };
    }
}
