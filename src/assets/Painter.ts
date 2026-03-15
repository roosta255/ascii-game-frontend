// src/assets/Painter.ts — Handles loading and parsing roles.json and doors.json into Renderer maps

import { Renderer, parseRenderer, RenderContext, render } from "./Renderer";

export interface FlyweightEntry {
    index: number;
    name: string;
}

export interface AnimationFlyweight {
    name: string;
    isTransition: boolean;
}

// Textures map names -> Sprites
// Painters map names -> Renderers.
export class Painter {
    renderers: Record<string, Renderer> = {};
    indexMap: Record<number, string> = {};

    constructor(renderers: Record<string, Renderer>) {
        this.renderers = renderers;
    }

    static async load(url: string): Promise<Painter> {
        const raw = await fetch(url).then(res => res.json());
        const renderers: Record<string, Renderer> = {};

        for (const [key, value] of Object.entries(raw)) {
            renderers[key] = parseRenderer(value);
        }

        console.log(renderers);
        return new Painter(renderers);
    }

    setIndexMap(entries: FlyweightEntry[]): void {
        this.indexMap = {};
        for (const { index, name } of entries) {
            this.indexMap[index] = name;
        }
    }

    getRenderer(key: string): Renderer {
        const renderer = this.renderers[key];
        if (!renderer) {
            console.warn(`Renderer for key "${key}" not found. Falling back to default renderer.`);
            return { type: "SpriteRenderer", sprite: "MISSING_ON_PURPOSE_I_WANT_THE_DEFAULT", palette: 0 };
        }
        return renderer;
    }

    draw(key: string, ctx: RenderContext): void {
        const renderer = this.getRenderer(key);
        render(renderer, ctx);
    }

    drawByIndex(index: number, ctx: RenderContext): void {
        const name = this.indexMap[index];
        if (name === undefined) {
            console.warn(`No flyweight mapping for index ${index}.`);
            return;
        }
        this.draw(name, ctx);
    }
}
