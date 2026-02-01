
export interface GridCalculator {
    position: [number, number];
    offset: [number, number];
    stride: [number, number];
};

export function calculatePosition(grid: GridCalculator, cell: [number, number]): [number, number] {
    return [
        grid.position[0] + grid.offset[0] + grid.stride[0] * cell[0],
        grid.position[1] + grid.offset[1] + grid.stride[1] * cell[1]
    ];
}
