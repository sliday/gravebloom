import { UnitDefinition } from './types';

export const CHESS_PIECES: Record<string, UnitDefinition> = {
  'piece.pawn': {
    id: 'piece.pawn',
    name: 'Pawn',
    pieceType: 'pawn',
    cost: 20,
    cooldown: 3.0,
    hp: 70,
    attackDamage: 12,
    attackInterval: 1.0,
    moveInterval: 1.0,
    description: 'Foot soldier. Marches 1 square toward the enemy King and strikes in melee.',
    chessRole: 'Pawn (1 forward / 1.0s, strikes straight ahead)'
  },
  'piece.knight': {
    id: 'piece.knight',
    name: 'Knight',
    pieceType: 'knight',
    cost: 45,
    cooldown: 7.0,
    hp: 110,
    attackDamage: 18,
    attackInterval: 1.0,
    moveInterval: 1.4,
    description: 'Vaults in an L-pattern (2 forward + 1 lateral). Jumps over intervening obstacles.',
    chessRole: 'Knight (L-jump 2+1 / 1.4s, vaults blockers)'
  },
  'piece.bishop': {
    id: 'piece.bishop',
    name: 'Bishop',
    pieceType: 'bishop',
    cost: 35,
    cooldown: 6.0,
    hp: 85,
    attackDamage: 15,
    attackInterval: 1.0,
    moveInterval: 0.9,
    description: 'Flanks along diagonal lines toward the enemy King, bypassing frontal blockades.',
    chessRole: 'Bishop (diagonal 1 / 0.9s, agile flanking)'
  },
  'piece.rook': {
    id: 'piece.rook',
    name: 'Rook',
    pieceType: 'rook',
    cost: 55,
    cooldown: 10.0,
    hp: 190,
    attackDamage: 22,
    attackInterval: 1.0,
    moveInterval: 0.8,
    description: 'Heavy armored fortress charging straight down files with crushing impact.',
    chessRole: 'Rook (straight 1 / 0.8s, heavy armored)'
  },
  'piece.queen': {
    id: 'piece.queen',
    name: 'Queen',
    pieceType: 'queen',
    cost: 85,
    cooldown: 20.0,
    hp: 280,
    attackDamage: 26,
    attackInterval: 1.0,
    moveInterval: 0.9,
    description: 'The supreme royal piece. Advances in any direction and cleaves adjacent foes.',
    chessRole: 'Queen (1 any-dir / 0.9s, royal cleave)'
  },
  'piece.king': {
    id: 'piece.king',
    name: 'King',
    pieceType: 'king',
    cost: 0,
    cooldown: 0,
    hp: 200,
    attackDamage: 30,
    attackInterval: 1.0,
    moveInterval: 1.0,
    description: 'Your on-board Commander. Can run around the field in all 8 directions to evade attackers. If King falls, match is lost.',
    chessRole: 'King (runs 8 directions, royal commander)'
  }
};

// Standard playable deck (Pawn, Bishop, Knight, Rook, Queen)
export const DECK_PIECES: string[] = [
  'piece.pawn',
  'piece.bishop',
  'piece.knight',
  'piece.rook',
  'piece.queen'
];

export const UNITS = CHESS_PIECES;
