import { describe, expect, it } from 'vitest';
import type { ActivePiece, GameSnapshot, PlayerId, SimEvent, UnitType } from '../sim/types';
import { GameRenderer, PIECE_EFFECT_PROFILES } from './renderer';

const PIECE_TYPES: UnitType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

interface RendererEffectState {
  isFlipped: boolean;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  cellSize: number;
  particles: unknown[];
  floatingTexts: unknown[];
  combatStrikes: Array<{ pieceType: UnitType; duration: number }>;
  moveTrails: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    pieceType: UnitType;
  }>;
  pieceBursts: Array<{ pieceType: UnitType; kind: 'deploy' | 'death'; duration: number }>;
  coronations: unknown[];
  pieceDisplays: Map<string, unknown>;
  screenFlash: number;
}

function createRendererHarness(): { renderer: GameRenderer; state: RendererEffectState } {
  const renderer = Object.create(GameRenderer.prototype) as GameRenderer;
  const state = renderer as unknown as RendererEffectState;
  Object.assign(state, {
    isFlipped: false,
    boardX: 0,
    boardY: 0,
    boardW: 320,
    boardH: 560,
    cellSize: 40,
    particles: [],
    floatingTexts: [],
    combatStrikes: [],
    moveTrails: [],
    pieceBursts: [],
    coronations: [],
    pieceDisplays: new Map(),
    screenFlash: 0
  });
  return { renderer, state };
}

function createPiece(pieceType: UnitType, uid: string, owner: PlayerId): ActivePiece {
  return {
    uid,
    defId: `piece.${pieceType}`,
    pieceType,
    owner,
    col: owner === 'player' ? 2 : 5,
    row: owner === 'player' ? 3 : 12,
    hp: 100,
    maxHp: 100,
    moveCooldown: 0,
    attackCooldown: 0
  };
}

function createSnapshot(attacker: ActivePiece): GameSnapshot {
  const playerKing = createPiece('king', 'player-king', 'player');
  const enemyKing = createPiece('king', 'enemy-king', 'enemy');

  return {
    tick: 1,
    timeSeconds: 1,
    isOvertime: false,
    isGameOver: false,
    player: {
      id: 'player',
      kingHp: 200,
      maxKingHp: 200,
      essence: 0,
      maxEssence: 100,
      deck: [],
      cooldowns: {}
    },
    enemy: {
      id: 'enemy',
      kingHp: 200,
      maxKingHp: 200,
      essence: 0,
      maxEssence: 100,
      deck: [],
      cooldowns: {}
    },
    playerKing: attacker.pieceType === 'king' ? attacker : playerKing,
    enemyKing,
    pieces: attacker.pieceType === 'king' ? [] : [attacker],
    recentEvents: []
  };
}

describe('piece effect profiles', () => {
  it('gives every chess piece a unique visual signature and timing', () => {
    const profiles = PIECE_TYPES.map((pieceType) => PIECE_EFFECT_PROFILES[pieceType]);

    expect(Object.keys(PIECE_EFFECT_PROFILES).sort()).toEqual([...PIECE_TYPES].sort());
    expect(new Set(profiles.map((profile) => profile.signature)).size).toBe(PIECE_TYPES.length);
    expect(new Set(profiles.map((profile) => profile.deployDuration)).size).toBe(PIECE_TYPES.length);
    expect(new Set(profiles.map((profile) => profile.strikeDuration)).size).toBe(PIECE_TYPES.length);
    expect(profiles.every((profile) => profile.deployDuration > profile.strikeDuration)).toBe(true);
  });

  it.each(PIECE_TYPES)('maps %s deploy events to its burst profile', (pieceType) => {
    const { renderer, state } = createRendererHarness();
    const event: SimEvent = {
      type: 'deploy',
      playerId: 'player',
      defId: `piece.${pieceType}`,
      col: 2,
      row: 3,
      uid: `${pieceType}-deploy`
    };

    renderer.pushEvents([event]);

    expect(state.pieceBursts).toEqual([
      expect.objectContaining({
        pieceType,
        kind: 'deploy',
        duration: PIECE_EFFECT_PROFILES[pieceType].deployDuration
      })
    ]);
    expect(state.particles).toHaveLength(PIECE_EFFECT_PROFILES[pieceType].particleCount);
  });

  it.each(PIECE_TYPES)('maps %s attack events to its strike profile', (pieceType) => {
    const { renderer, state } = createRendererHarness();
    const attacker = createPiece(pieceType, `${pieceType}-attacker`, 'player');
    const event: SimEvent = {
      type: 'attack',
      attackerUid: attacker.uid,
      targetUid: 'enemy-target',
      col: 5,
      row: 12,
      damage: 12
    };

    renderer.pushEvents([event], createSnapshot(attacker));

    expect(state.combatStrikes).toEqual([
      expect.objectContaining({
        pieceType,
        duration: PIECE_EFFECT_PROFILES[pieceType].strikeDuration
      })
    ]);
  });

  it.each(PIECE_TYPES)('maps %s death events to its burst profile', (pieceType) => {
    const { renderer, state } = createRendererHarness();
    const event: SimEvent = {
      type: 'piece_death',
      uid: `${pieceType}-defeated`,
      defId: `piece.${pieceType}`,
      col: 5,
      row: 12,
      owner: 'enemy'
    };

    renderer.pushEvents([event]);

    expect(state.pieceBursts).toEqual([
      expect.objectContaining({
        pieceType,
        kind: 'death',
        duration: PIECE_EFFECT_PROFILES[pieceType].deployDuration * 0.8
      })
    ]);
    expect(state.particles).toHaveLength(PIECE_EFFECT_PROFILES[pieceType].particleCount);
  });

  it('maps king movement to a king trail and ward burst', () => {
    const { renderer, state } = createRendererHarness();
    const event: SimEvent = {
      type: 'king_move',
      playerId: 'player',
      fromCol: 2,
      fromRow: 3,
      toCol: 3,
      toRow: 4
    };

    renderer.pushEvents([event]);

    expect(state.moveTrails).toEqual([
      expect.objectContaining({
        fromX: 100,
        fromY: 540,
        toX: 140,
        toY: 500,
        pieceType: 'king'
      })
    ]);
    expect(state.pieceBursts).toEqual([
      expect.objectContaining({
        pieceType: 'king',
        kind: 'deploy',
        duration: PIECE_EFFECT_PROFILES.king.deployDuration
      })
    ]);
  });
});

describe('piece health sectors', () => {
  function drawHealthBar(pieceType: UnitType, hp: number, maxHp: number): Array<{ color: string; width: number }> {
    const renderer = Object.create(GameRenderer.prototype) as GameRenderer;
    const fills: Array<{ color: string; width: number }> = [];
    const context = {
      fillStyle: '',
      fillRect(_x: number, _y: number, width: number): void {
        fills.push({ color: this.fillStyle, width });
      }
    };

    Object.assign(renderer, { ctx: context, cellSize: 40 });
    const healthRenderer = renderer as unknown as {
      drawHealthBar(
        cx: number,
        cy: number,
        currentHp: number,
        maxHp: number,
        owner: PlayerId,
        type: UnitType
      ): void;
    };
    healthRenderer.drawHealthBar(20, 10, hp, maxHp, 'player', pieceType);

    return fills;
  }

  it.each<[UnitType, number, number]>([
    ['pawn', 70, 6],
    ['knight', 110, 7],
    ['bishop', 85, 6],
    ['rook', 190, 8],
    ['queen', 280, 8],
    ['king', 200, 7]
  ])('gives %s one sector per survivable hit, capped at eight visible sectors', (pieceType, maxHp, expectedSectors) => {
    const fills = drawHealthBar(pieceType, maxHp, maxHp);

    expect(fills).toHaveLength(expectedSectors + 1);
    expect(fills.slice(1).every((fill) => fill.width > 0)).toBe(true);
  });

  it('draws only the surviving full sectors and final partial sector', () => {
    const fills = drawHealthBar('pawn', 13, 70);

    expect(fills).toHaveLength(3);
    expect(fills[2].width).toBeCloseTo(fills[1].width / 12);
  });

  it('leaves only the empty track at zero health', () => {
    const fills = drawHealthBar('rook', 0, 190);

    expect(fills).toHaveLength(1);
    expect(fills[0].color).toBe('#141A24');
  });
});
