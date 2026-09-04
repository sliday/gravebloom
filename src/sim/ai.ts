import { GameSim } from './sim';
import { PlayerId, DeployIntent } from './types';
import { CHESS_PIECES } from './units';
import { BOARD_COLS, getChebyshevDistance, getLegalKingMoves, getLegalDeploymentCells } from './board';

export type AIDifficulty = 'apprentice' | 'tactical' | 'nightmare';

export class BotAI {
  public playerId: PlayerId;
  public difficulty: AIDifficulty;
  private nextDecisionTime = 0;
  private decisionInterval = 1.4;
  public openingDelay = 18.0; // 18s opening buffer for apprentice so new players don't die while reading cards (Issue #1)

  constructor(playerId: PlayerId = 'enemy', difficulty: AIDifficulty = 'apprentice') {
    this.playerId = playerId;
    this.difficulty = difficulty;
    this.setDifficulty(difficulty);
  }

  public setDifficulty(diff: AIDifficulty): void {
    this.difficulty = diff;
    if (diff === 'apprentice') {
      this.decisionInterval = 1.4;
      this.openingDelay = 18.0;
    } else if (diff === 'nightmare') {
      this.decisionInterval = 0.3;
      this.openingDelay = 4.0;
    } else {
      this.decisionInterval = 0.7;
      this.openingDelay = 10.0;
    }
  }

  public update(sim: GameSim): DeployIntent | null {
    if (sim.isGameOver) return null;

    // Issue #1: 10s opening delay gives player breathing room to observe the board and read cards
    if (sim.matchTime < this.openingDelay) return null;

    const pState = this.playerId === 'enemy' ? sim.enemy : sim.player;

    if (sim.matchTime < this.nextDecisionTime) return null;
    this.nextDecisionTime = sim.matchTime + this.decisionInterval;

    // Piece deployment on legal half
    const hasActiveQueen = sim.pieces.some(
      (p) => p.owner === this.playerId && p.pieceType === 'queen' && p.hp > 0
    );
    const availableCards = pState.deck.filter(
      (c) =>
        (pState.cooldowns[c] ?? 0) <= 0 &&
        pState.essence >= CHESS_PIECES[c]?.cost &&
        (c !== 'piece.queen' || !hasActiveQueen)
    );
    if (availableCards.length === 0) return null;

    let chosenCard = availableCards[Math.floor(sim.prng.next() * availableCards.length)];

    if (availableCards.includes('piece.queen') && pState.essence >= 85) {
      chosenCard = 'piece.queen';
    } else if (availableCards.includes('piece.rook') && pState.essence >= 55) {
      chosenCard = 'piece.rook';
    } else if (availableCards.includes('piece.knight') && sim.prng.next() > 0.5) {
      chosenCard = 'piece.knight';
    }

    const legalCells = getLegalDeploymentCells(this.playerId);
    const emptyCells = legalCells.filter((c) => sim.getPieceAt(c.col, c.row) === undefined);
    if (emptyCells.length === 0) return null;

    const chosenCell = emptyCells[Math.floor(sim.prng.next() * emptyCells.length)];

    return {
      playerId: this.playerId,
      cardId: chosenCard,
      col: chosenCell.col,
      row: chosenCell.row,
      tick: sim.tick
    };
  }
}
