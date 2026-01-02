
export interface LockRenderer {
    type: "Unrendered" | "SpriteRenderer";
    sprite?: string;
    palette?: string;
}

export interface LocksMeta {
    [doorType: string]: {
        renderer: LockRenderer;
    };
}

export function loadLocksMeta(raw: any): LocksMeta {
    return raw as LocksMeta;
}