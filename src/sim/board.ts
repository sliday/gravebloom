import { CellCoord, PlayerId } from './types';

// Two full 8x8 chess boards meeting at the center: 8 columns x 16 rows (128 squares)
export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;

// Player's full 8x8 board
export const PLAYER_HALF_ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

// Enemy's full 8x8 board
export const ENEMY_HALF_ROWS = [9, 10, 11, 12, 13, 14, 15, 16];

export function isInsideBoard(col: number, row: number): boolean {
  return col >= 0 && col < BOARD_COLS && row >= 1 && row <= BOARD_ROWS;
}

// Allow placing pieces anywhere on player's full 8x8 half of the board
export function getLegalDeploymentCells(playerId: PlayerId): CellCoord[] {
  const cells: CellCoord[] = [];
  const rows = playerId === 'player' ? PLAYER_HALF_ROWS : ENEMY_HALF_ROWS;
  for (let col = 0; col < BOARD_COLS; col++) {
    for (const row of rows) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export function getChebyshevDistance(c1: { col: number; row: number }, c2: { col: number; row: number }): number {
  return Math.max(Math.abs(c1.col - c2.col), Math.abs(c1.row - c2.row));
}

export function getManhattanDistance(c1: { col: number; row: number }, c2: { col: number; row: number }): number {
  return Math.abs(c1.col - c2.col) + Math.abs(c1.row - c2.row);
}

// 1. Strict King Moves (1 square in all 8 directions)
export function getLegalKingMoves(col: number, row: number): CellCoord[] {
  const moves: CellCoord[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const c = col + dc;
      const r = row + dr;
      if (isInsideBoard(c, r)) {
        moves.push({ col: c, row: r });
      }
    }
  }
  return moves;
}

// 2. Strict Knight L-jumps (8 target squares, jumps over obstacles)
export function getKnightLTargets(col: number, row: number): CellCoord[] {
  const deltas = [
    [-1, -2], [1, -2],
    [-2, -1], [2, -1],
    [-2, 1], [2, 1],
    [-1, 2], [1, 2]
  ];
  const targets: CellCoord[] = [];
  for (const [dc, dr] of deltas) {
    const c = col + dc;
    const r = row + dr;
    if (isInsideBoard(c, r)) {
      targets.push({ col: c, row: r });
    }
  }
  return targets;
}

// 3. Strict Pawn Diagonal Attack Squares (strictly diagonally forward 1 step)
export function getPawnDiagonalAttacks(col: number, row: number, forwardDir: 1 | -1): CellCoord[] {
  const attacks: CellCoord[] = [];
  const targetRow = row + forwardDir;
  if (targetRow >= 1 && targetRow <= BOARD_ROWS) {
    if (col - 1 >= 0) attacks.push({ col: col - 1, row: targetRow });
    if (col + 1 < BOARD_COLS) attacks.push({ col: col + 1, row: targetRow });
  }
  return attacks;
}

// 4. Strict Raycasting for Rook, Bishop, Queen (stopped by any obstacle)
export interface RayResult {
  dir: [number, number];
  openCells: CellCoord[];
  hitPiece?: { col: number; row: number; isEnemy: boolean };
}

export function castChessRays(
  col: number,
  row: number,
  directions: [number, number][],
  cellCheck: (c: number, r: number) => 'empty' | 'friendly' | 'enemy'
): RayResult[] {
  const results: RayResult[] = [];

  for (const [dc, dr] of directions) {
    const openCells: CellCoord[] = [];
    let curC = col + dc;
    let curR = row + dr;
    let hit: { col: number; row: number; isEnemy: boolean } | undefined = undefined;

    while (isInsideBoard(curC, curR)) {
      const state = cellCheck(curC, curR);
      if (state === 'empty') {
        openCells.push({ col: curC, row: curR });
      } else if (state === 'enemy') {
        hit = { col: curC, row: curR, isEnemy: true };
        break; // Ray is blocked by enemy piece
      } else {
        hit = { col: curC, row: curR, isEnemy: false };
        break; // Ray is blocked by friendly piece
      }
      curC += dc;
      curR += dr;
    }

    results.push({
      dir: [dc, dr],
      openCells,
      hitPiece: hit
    });
  }

  return results;
}
