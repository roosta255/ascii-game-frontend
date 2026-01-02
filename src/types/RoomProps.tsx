
interface RoomCellProps {
    stride: [number, number];
    offset: [number, number];
    size: [number, number];
};

export interface RoomProps {
    position: [number, number];
    cells: RoomCellProps;
};

export function toFloorGlyphsFromCell(room: RoomProps, cell: [number, number]): [number, number] {
    const [cellX, cellY] = cell;
    const [offsetX, offsetY] = room.cells.offset;
    const [strideX, strideY] = room.cells.stride;
    const [positionX, positionY] = room.position;
    return [
        cellX * strideX + positionX + offsetX,
        cellY * strideY + positionY + offsetY,
    ];
}

export function toFloorGlyphsFromDoor(room: RoomProps, direction: number): [number, number] {
    switch(direction) {
        case 0:
            return toFloorGlyphsFromCell(room, [1, -1]);
        case 1:
            return toFloorGlyphsFromCell(room, [4, 2]);
        case 2:
            return toFloorGlyphsFromCell(room, [1, 5]);
        case 3:
            return toFloorGlyphsFromCell(room, [-1, 2]);
    }
    return toFloorGlyphsFromCell(room, [0, 0]);
}

export function toFloorGlyphsFromLock(room: RoomProps, direction: number): [number, number] {
    switch(direction) {
        case 0:
            return toFloorGlyphsFromCell(room, [3, -1]);
        case 1:
            return toFloorGlyphsFromCell(room, [4, 0]);
        case 2:
            return toFloorGlyphsFromCell(room, [3, 5]);
        case 3:
            return toFloorGlyphsFromCell(room, [-1, 0]);
    }
    return toFloorGlyphsFromCell(room, [0, 0]);
}
