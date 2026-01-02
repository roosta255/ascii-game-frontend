export interface DirectionalIconRendererEntry {
    sprite: string;
    palette: number;
}

export interface DoorRenderer {
    type: "Unrendered" | "DirectionalIconRenderer" | "SpriteRenderer";
    directions?: DirectionalIconRendererEntry[];
    sprite?: string;
    palette?: string;
}

export interface DoorsMeta {
    [doorType: string]: {
        renderer: DoorRenderer;
    };
}

export function loadDoorsMeta(raw: any): DoorsMeta {
    return raw as DoorsMeta;
}