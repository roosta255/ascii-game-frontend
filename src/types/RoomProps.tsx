
interface RoomCellProps {
    stride: [number, number];
    offset: [number, number];
};

export interface RoomProps {
    index: number;
    position: [number, number];
    size: [number, number];
    cells: RoomCellProps;
};

export function toFloorGlyphsFromCell(room: RoomProps, floorId: number): [number, number] {
    const cellX = floorId % room.size[0];
    const cellY = Math.floor(floorId / room.size[0]);
    const [offsetX, offsetY] = room.cells.offset;
    const [strideX, strideY] = room.cells.stride;
    const [positionX, positionY] = room.position;
    return [
        cellX * strideX + positionX + offsetX,
        cellY * strideY + positionY + offsetY,
    ];
}

export function toFloorGlyphsFromLock(
    room: RoomProps,
    direction: number
): [number, number] {
    const wall = room.cells.walls?.[direction];
    if (!wall?.lock) {
        return [0,0];
        // throw new Error(`No lock defined for wall direction ${direction}`);
    }

    const [offsetX, offsetY] = wall.lock.offset;
    const [positionX, positionY] = room.position;

    return [
        positionX + offsetX,
        positionY + offsetY,
    ];
}

export function toFloorGlyphsFromDoor(
    room: RoomProps,
    direction: number
): [number, number] {
    const wall = room.cells.walls?.[direction];
    if (!wall?.door) {
        return [0,0];
        // throw new Error(`No door defined for wall direction ${direction}`);
    }

    const [offsetX, offsetY] = wall.door.offset;
    const [positionX, positionY] = room.position;

    return [
        positionX + offsetX,
        positionY + offsetY,
    ];
}

interface WallPartProps {
    offset: [number, number];
}

interface WallProps {
    door?: WallPartProps;
    lock?: WallPartProps;
}

interface RoomCellProps {
    stride: [number, number];
    offset: [number, number];
    walls?: WallProps[]; // index = direction (N,E,S,W)
}

// Textures map names -> Sprites
// Painters map names -> Renderers.
export class RoomPropLoader {
    props: Record<string, RoomCellProps> = {};

    constructor(props: Record<string, RoomCellProps>) {
        this.props = props;
    }

    static async load(url: string): Promise<RoomPropLoader> {
        const raw = await fetch(url).then(res => res.json());
        const properties: Record<string, RoomCellProps> = {};

        for (const [key, value] of Object.entries(raw)) {
            if (typeof value !== "object" || value === null) {
                throw new Error(`Invalid room entry: ${key}`);
            }

            const v = value as any;

            if (
                !Array.isArray(v.stride) || v.stride.length !== 2 ||
                !Array.isArray(v.offset) || v.offset.length !== 2
            ) {
                throw new Error(`Invalid stride/offset for room "${key}"`);
            }

            const room: RoomCellProps = {
                stride: v.stride.map(Number) as [number, number],
                offset: v.offset.map(Number) as [number, number],
            };

            if (Array.isArray(v.walls)) {
                room.walls = v.walls.map((w: any, wallIndex: number) => {
                    if (typeof w !== "object" || w === null) {
                        throw new Error(
                            `Invalid wall definition for room "${key}" at index ${wallIndex}`
                        );
                    }

                    const wall: WallProps = {};

                    if (w.door) {
                        if (
                            !Array.isArray(w.door.offset) ||
                            w.door.offset.length !== 2
                        ) {
                            throw new Error(
                                `Invalid door offset for room "${key}" wall ${wallIndex}`
                            );
                        }

                        wall.door = {
                            offset: w.door.offset.map(Number) as [number, number]
                        };
                    }

                    if (w.lock) {
                        if (
                            !Array.isArray(w.lock.offset) ||
                            w.lock.offset.length !== 2
                        ) {
                            throw new Error(
                                `Invalid lock offset for room "${key}" wall ${wallIndex}`
                            );
                        }

                        wall.lock = {
                            offset: w.lock.offset.map(Number) as [number, number]
                        };
                    }

                    return wall;
                });
            }

            properties[key] = room;
        }

        return new RoomPropLoader(properties);
    }

    getProps(key: string): RoomCellProps {
        const properties = this.props[key];
        if (!properties) {
            console.warn(`RoomCellProperties for key "${key}" not found. Falling back to default properties.`);
            return { stride: [6,5], offset: [8,8] };
        }
        return properties;
    }

}
