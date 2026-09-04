export type PlayerId = 'player' | 'enemy';

export type UnitType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface UnitDefinition {
  id: string;
  name: string;
  pieceType: UnitType;
  cost: number;
  cooldown: number; // seconds
  hp: number;
  attackDamage: number;
  attackInterval: number; // seconds
  moveInterval: number; // seconds
  description: string;
  chessRole: string;
}

export interface CellCoord {
  col: number; // 0..7
  row: number; // 1..14
}

export interface ActivePiece {
  uid: string;
  defId: string;
  pieceType: UnitType;
  owner: PlayerId;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  moveCooldown: number;
  attackCooldown: number;
  lateralDir?: 1 | -1;
  lastDamageTakenTime?: number;
}

export interface KingPiece extends ActivePiece {
  pieceType: 'king';
  isAlive: boolean;
}

export interface PlayerState {
  id: PlayerId;
  kingHp: number;
  maxKingHp: number;
  essence: number;
  maxEssence: number;
  deck: string[]; // piece card IDs
  cooldowns: Record<string, number>;
}

export interface DeployIntent {
  playerId: PlayerId;
  cardId: string;
  col: number;
  row: number;
  tick: number;
}

export interface KingMoveIntent {
  playerId: PlayerId;
  targetCol: number;
  targetRow: number;
}

export type SimEvent =
  | { type: 'deploy'; playerId: PlayerId; defId: string; col: number; row: number; uid: string }
  | { type: 'attack'; attackerUid: string; targetUid: string; col: number; row: number; damage: number; isFlanked?: boolean }
  | { type: 'bounty'; playerId: PlayerId; bounty: number; pieceType: UnitType; col: number; row: number }
  | { type: 'pawn_promote'; playerId: PlayerId; col: number; row: number; uid: string }
  | { type: 'king_move'; playerId: PlayerId; fromCol: number; fromRow: number; toCol: number; toRow: number }
  | { type: 'king_damage'; targetPlayerId: PlayerId; damage: number; remainingHp: number }
  | { type: 'piece_death'; uid: string; defId: string; col: number; row: number; owner: PlayerId }
  | { type: 'overtime_start' }
  | { type: 'game_over'; winner: PlayerId | 'draw'; reason: string };

export interface GameSnapshot {
  tick: number;
  timeSeconds: number;
  isOvertime: boolean;
  isGameOver: boolean;
  winner?: PlayerId | 'draw';
  player: PlayerState;
  enemy: PlayerState;
  playerKing: ActivePiece;
  enemyKing: ActivePiece;
  pieces: ActivePiece[];
  recentEvents: SimEvent[];
}
