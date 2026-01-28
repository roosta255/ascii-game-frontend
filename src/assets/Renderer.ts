// src/systems/RendererSystem.ts — Refactored to remove if-chains using function mapping for TypeScript polymorphism

import { DrawerProps } from "../types/DrawerProps";

export interface DirectionalIconRendererEntry {
    sprite: string;
    palette: number;
}

export type Renderer =
    | { type: "Unrendered" }
    | { type: "BackgroundRenderer"; sprite: string; palette: number }
    | { type: "CharacterRenderer"; sprite: string; palette: number }
    | { type: "DirectionalIconRenderer"; directions: DirectionalIconRendererEntry[] }
    | { type: "DoorwayRenderer"; sprite: string }
    | { type: "SpriteRenderer"; sprite: string; palette: number };

export interface RenderContext {
    globals: DrawerProps;
    locals: {
        coords: [number, number];
        direction?: number;
        onClick?: () => void;
        room?: any;
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
        case "BackgroundRenderer": 
            return { type: "BackgroundRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        case "DoorRenderer":
            return { type: "DoorRenderer", directions: raw.renderer.directions };
        case "DoorwayRenderer":
            return { type: "DoorwayRenderer", sprite: raw.renderer.sprite };
        case "CharacterRenderer":
            return { type: "CharacterRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        case "SpriteRenderer":
            return { type: "SpriteRenderer", sprite: raw.renderer.sprite, palette: raw.renderer.palette };
        default:
            console.warn(`⚠️ Unknown renderer type: ${raw.renderer.type}, defaulting to Unrendered`);
            return { type: "Unrendered" };
    }
}
