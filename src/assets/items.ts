
export interface ItemRenderer {
    type: "Unrendered" | "SpriteRenderer";
    sprite?: string;
    palette?: string;
}

export interface ItemsMeta {
    [doorType: string]: {
        renderer: ItemRenderer;
    };
}

export function loadItemsMeta(raw: any): ItemsMeta {
    return raw as ItemsMeta;
}