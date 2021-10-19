export function randomMaze(grid, startNode, finishNode) {
    if (!startNode || !finishNode || startNode === finishNode) {
        return false;
    }
    let walls = [];
    for (let row = 0; row < grid[0].length; row++) {
        for (let col = 0; col < grid.length; col++) {
            if (
                (row === startNode.row && col === startNode.col) ||
                (row === finishNode.row && col === finishNode.col)
            )
                continue;
            if (Math.random() < 0.33) {
                walls.push([row, col]);
            }
        }
    }
    // walls.sort(() => Math.random() - 0.25);
    return walls;
}