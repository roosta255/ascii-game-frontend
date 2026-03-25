import type { FlyweightEntry, AnimationFlyweight } from "./Painter";

type LabelMap = Record<string, { label?: string; description?: string }>;

type Flyweights = {
    roles: FlyweightEntry[];
    doors: FlyweightEntry[];
    locks: FlyweightEntry[];
    items: FlyweightEntry[];
    animations: AnimationFlyweight[];
};

function applyLabels(entries: FlyweightEntry[], labels: LabelMap): FlyweightEntry[] {
    return entries.map(entry => ({
        ...entry,
        label: labels[entry.name]?.label,
        description: labels[entry.name]?.description,
    }));
}

export async function decorateFlyweights(raw: Flyweights, baseUrl: string): Promise<Flyweights> {
    const [rolesLabels, doorsLabels, itemsLabels, chestLocksLabels] = await Promise.all([
        fetch(`${baseUrl}labels/roles.json`).then(r => r.json() as Promise<LabelMap>),
        fetch(`${baseUrl}labels/doors.json`).then(r => r.json() as Promise<LabelMap>),
        fetch(`${baseUrl}labels/items.json`).then(r => r.json() as Promise<LabelMap>),
        fetch(`${baseUrl}labels/chest_locks.json`).then(r => r.json() as Promise<LabelMap>),
    ]);

    return {
        roles: applyLabels(raw.roles, rolesLabels),
        doors: applyLabels(raw.doors, doorsLabels),
        locks: applyLabels(raw.locks, chestLocksLabels),
        items: applyLabels(raw.items, itemsLabels),
        animations: raw.animations,
    };
}
