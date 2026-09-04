import { describe, it, expect } from 'vitest';
import { BotAI } from './ai';
import { GameSim } from './sim';

describe('GRAVEBLOOM Chess Combat Sim with On-Board Kings', () => {
  it('1. Kings spawn on-board at row 1 and row 16 with 200 HP', () => {
    const sim = new GameSim(101);
    expect(sim.playerKing.col).toBe(4);
    expect(sim.playerKing.row).toBe(1);
    expect(sim.playerKing.hp).toBe(200);

    expect(sim.enemyKing.col).toBe(4);
    expect(sim.enemyKing.row).toBe(16);
    expect(sim.enemyKing.hp).toBe(200);
  });

  it('2. King movement enforces its 0.7 second cooldown', () => {
    const sim = new GameSim(202);
    // Move player king from (4, 1) to (4, 2)
    const success1 = sim.moveKing('player', 4, 2);
    expect(success1).toBe(true);
    expect(sim.playerKing.row).toBe(2);

    // Reject another move until the cooldown elapses
    const tooSoon = sim.moveKing('player', 5, 3);
    expect(tooSoon).toBe(false);

    sim.stepSeconds(0.7);
    const success2 = sim.moveKing('player', 5, 3);
    expect(success2).toBe(true);
    expect(sim.playerKing.col).toBe(5);
    expect(sim.playerKing.row).toBe(3);

    // Reject illegal jump (distance > 1)
    const illegal = sim.moveKing('player', 1, 10);
    expect(illegal).toBe(false);
  });

  it('3. Pieces hunt and attack the enemy King', () => {
    const sim = new GameSim(303);
    sim.player.essence = 100;
    const ok = sim.deployPiece('player', 'piece.queen', 4, 7);
    expect(ok).toBe(true);

    const queen = sim.pieces.find((p) => p.pieceType === 'queen')!;
    expect(queen).toBeDefined();

    // Step sim until Queen reaches and attacks enemy King
    sim.stepSeconds(15.0);

    // Enemy king should take damage
    expect(sim.enemyKing.hp).toBeLessThan(200);
  });

  it('4. Game Over occurs when King is defeated (no abstract core lives)', () => {
    const sim = new GameSim(404);
    sim.enemyKing.hp = 10;

    // Direct piece next to enemy king
    sim.pieces.push({
      uid: 'killer_rook',
      defId: 'piece.rook',
      pieceType: 'rook',
      owner: 'player',
      col: 4,
      row: 13,
      hp: 100,
      maxHp: 100,
      moveCooldown: 0,
      attackCooldown: 0
    });

    sim.stepSeconds(1.0);

    expect(sim.isGameOver).toBe(true);
    expect(sim.winner).toBe('player');
  });

  it('stops the expiry tick before combat and records the game-over event', () => {
    const sim = new GameSim(405);
    sim.matchDuration = 0.1;
    sim.playerKing.hp = 10;
    sim.player.kingHp = 10;
    sim.enemyKing.hp = 5;
    sim.enemy.kingHp = 5;
    sim.pieces.push({
      uid: 'expiry_rook',
      defId: 'piece.rook',
      pieceType: 'rook',
      owner: 'enemy',
      col: 4,
      row: 2,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    });

    const events = sim.step();

    expect(sim.winner).toBe('player');
    expect(sim.playerKing.hp).toBe(10);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'game_over', winner: 'player' });
    expect(sim.eventLog).toEqual(events);
  });

  it('5. Pawn Promotion: Pawns promote to Queens upon reaching opposing back rank', () => {
    const sim = new GameSim(505);
    // Player pawn at row 15
    const pawn = {
      uid: 'hero_pawn',
      defId: 'piece.pawn',
      pieceType: 'pawn' as const,
      owner: 'player' as const,
      col: 2,
      row: 15,
      hp: 60,
      maxHp: 60,
      moveCooldown: 0,
      attackCooldown: 0
    };
    sim.pieces.push(pawn);

    // Step 1.0s: pawn steps from row 15 to row 16
    sim.stepSeconds(1.0);

    // Pawn must now be promoted to a Queen!
    expect(pawn.row).toBe(16);
    expect(pawn.pieceType).toBe('queen');
    expect(pawn.defId).toBe('piece.queen');
    expect(pawn.maxHp).toBe(280);
  });

  it('6. Pieces must not overlap: cannot deploy onto an occupied cell', () => {
    const sim = new GameSim(606);
    sim.player.essence = 100;

    // Deploy pawn at (col 3, row 5)
    const ok1 = sim.deployPiece('player', 'piece.pawn', 3, 5);
    expect(ok1).toBe(true);

    // Attempt to deploy another piece on the exact same square (3, 5)
    const ok2 = sim.deployPiece('player', 'piece.knight', 3, 5);
    expect(ok2).toBe(false);
  });

  it('rejects a registered piece that is not in the player deck', () => {
    const sim = new GameSim(607);
    sim.player.essence = 100;

    const deployed = sim.deployPiece('player', 'piece.king', 3, 5);

    expect(deployed).toBe(false);
    expect(sim.pieces).toHaveLength(0);
    expect(sim.player.essence).toBe(100);
    expect(sim.events).toHaveLength(0);
  });

  it('7. Player King tactical evasion: King flees when threatened within friendly half', () => {
    const sim = new GameSim(707);
    // Place an enemy Rook on the King's file (col 4, row 5)
    sim.pieces.push({
      uid: 'threat_rook',
      defId: 'piece.rook',
      pieceType: 'rook',
      owner: 'enemy',
      col: 4,
      row: 5,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 10
    });

    // Step 1.0s
    sim.stepSeconds(1.0);

    // King should step out of the file to evade the Rook's line of sight
    const hasEvaded = sim.playerKing.col !== 4 || sim.playerKing.row !== 1;
    expect(hasEvaded).toBe(true);
  });

  it('8. Flanking Bonus: target engaged by >=2 friendly attackers takes +25% damage', () => {
    const sim = new GameSim(808);
    // Enemy Knight at (col 3, row 5) with 100 HP
    sim.pieces.push({
      uid: 'target_knight',
      defId: 'piece.knight',
      pieceType: 'knight',
      owner: 'enemy',
      col: 3,
      row: 5,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 10
    });

    // Player Rook at (col 3, row 4) facing it straight on file
    sim.pieces.push({
      uid: 'atk_rook',
      defId: 'piece.rook',
      pieceType: 'rook',
      owner: 'player',
      col: 3,
      row: 4,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    });

    // Player Bishop at (col 2, row 4) facing it diagonally
    sim.pieces.push({
      uid: 'atk_bishop',
      defId: 'piece.bishop',
      pieceType: 'bishop',
      owner: 'player',
      col: 2,
      row: 4,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    });

    // Step 0.1s: Rook base damage is 22. With +25% flanking, damage is round(22 * 1.25) = 28!
    sim.step();

    const victim = sim.pieces.find((p) => p.uid === 'target_knight')!;
    // Damage dealt should include the 25% flanking bonus
    expect(victim.hp).toBeLessThanOrEqual(72);
  });

  it('9. Capture Bounties: capturing an enemy Knight awards +10 essence', () => {
    const sim = new GameSim(909);
    sim.player.essence = 30;

    // Enemy Knight with 5 HP
    sim.pieces.push({
      uid: 'weak_knight',
      defId: 'piece.knight',
      pieceType: 'knight',
      owner: 'enemy',
      col: 3,
      row: 5,
      hp: 5,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 10
    });

    // Player Rook that strikes it
    sim.pieces.push({
      uid: 'killer_rook',
      defId: 'piece.rook',
      pieceType: 'rook',
      owner: 'player',
      col: 3,
      row: 4,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    });

    sim.step();

    // Player essence should increase by +10 (bounty for Knight)
    expect(sim.player.essence).toBeGreaterThanOrEqual(40);
  });

  it('10. Connected Pawns: supported pawn takes 20% reduced damage', () => {
    const sim = new GameSim(1010);
    // Supported Player Pawn at (col 3, row 3)
    const victimPawn = {
      uid: 'pawn_front',
      defId: 'piece.pawn',
      pieceType: 'pawn' as const,
      owner: 'player' as const,
      col: 3,
      row: 3,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 10
    };
    // Supporting Player Pawn diagonal-adjacent at (col 2, row 2)
    const supportPawn = {
      uid: 'pawn_support',
      defId: 'piece.pawn',
      pieceType: 'pawn' as const,
      owner: 'player' as const,
      col: 2,
      row: 2,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 10
    };
    sim.pieces.push(victimPawn, supportPawn);

    // Enemy Rook attacks it. Base damage = 22. With 20% reduction: round(22 * 0.8) = 18!
    sim.pieces.push({
      uid: 'enemy_rook',
      defId: 'piece.rook',
      pieceType: 'rook' as const,
      owner: 'enemy' as const,
      col: 3,
      row: 4,
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    });

    sim.step();

    // 100 - 18 = 82 HP remaining
    expect(victimPawn.hp).toBe(82);
  });

  it('11. Rook charge: Rook charges up to 8 cells along open file in one move', () => {
    const sim = new GameSim(1111);
    const rook = {
      uid: 'test_rook',
      defId: 'piece.rook',
      pieceType: 'rook' as const,
      owner: 'player' as const,
      col: 2,
      row: 4,
      hp: 100,
      maxHp: 100,
      moveCooldown: 0,
      attackCooldown: 10
    };
    sim.pieces.push(rook);

    // Step 0.1s: rook charges open file up to 8 squares (row 4 -> row 12)
    sim.step();

    expect(rook.row).toBe(12);
  });

  it('12. Bishop slide: Bishop slides diagonally up to 8 cells along open diagonal', () => {
    const sim = new GameSim(1212);
    const bishop = {
      uid: 'test_bishop',
      defId: 'piece.bishop',
      pieceType: 'bishop' as const,
      owner: 'player' as const,
      col: 1,
      row: 3,
      hp: 100,
      maxHp: 100,
      moveCooldown: 0,
      attackCooldown: 10
    };
    sim.pieces.push(bishop);

    // Step 0.1s: bishop slides diagonally up to open squares toward enemy King
    sim.step();

    expect(bishop.row).toBeGreaterThan(3);
    expect(bishop.col).toBeGreaterThan(1);
  });

  it('13. Bishop standoff: Bishop attacks King from afar and avoids stepping to 1 cell distance', () => {
    const sim = new GameSim(1313);
    // Enemy King at (col 4, row 16)
    // Place player Bishop at (col 1, row 13) which is diagonal to (col 4, row 16): |1-4|=3, |13-16|=3
    const bishop = {
      uid: 'sniper_bishop',
      defId: 'piece.bishop',
      pieceType: 'bishop' as const,
      owner: 'player' as const,
      col: 1,
      row: 13,
      hp: 100,
      maxHp: 100,
      moveCooldown: 0,
      attackCooldown: 0
    };
    sim.pieces.push(bishop);

    // Step 0.1s: Bishop should attack King from distance 3, staying at range!
    sim.step();

    expect(sim.enemyKing.hp).toBeLessThan(200);
    expect(bishop.row).toBe(13);
    expect(bishop.col).toBe(1);
  });

  it('14. Dual Rook tactical split: Siege Rook targets King, Sweeper Rook targets low-HP blocker', () => {
    const sim = new GameSim(1414);
    // Enemy King at (4, 16) with 200 HP
    // Low HP enemy pawn at (4, 12) with 10 HP
    const weakPawn = {
      uid: 'enemy_pawn',
      defId: 'piece.pawn',
      pieceType: 'pawn' as const,
      owner: 'enemy' as const,
      col: 2,
      row: 14,
      hp: 10,
      maxHp: 70,
      moveCooldown: 10,
      attackCooldown: 10
    };
    sim.pieces.push(weakPawn);

    // Friendly Rook 1 (Siege Anchor, uid sorted first)
    const rook1 = {
      uid: 'rook_1',
      defId: 'piece.rook',
      pieceType: 'rook' as const,
      owner: 'player' as const,
      col: 4,
      row: 14, // On file 4 with Enemy King (4, 16), and on row 14 with weak pawn (2, 14)
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    };

    // Friendly Rook 2 (Sweeper, uid sorted second)
    const rook2 = {
      uid: 'rook_2',
      defId: 'piece.rook',
      pieceType: 'rook' as const,
      owner: 'player' as const,
      col: 3,
      row: 14, // Also has weak pawn (2, 14) and King (4, 16) reachable via orthogonal lines
      hp: 100,
      maxHp: 100,
      moveCooldown: 10,
      attackCooldown: 0
    };
    sim.pieces.push(rook1, rook2);

    // Candidates for Rook 1: King (4, 16) and weak pawn (2, 14)
    const bestTargetRook1 = sim.selectBestAttackTarget(rook1, [sim.enemyKing, weakPawn], 22);
    // Rook 1 (Siege) must prioritize King!
    expect(bestTargetRook1.pieceType).toBe('king');

    // Candidates for Rook 2: King (4, 16) and weak pawn (2, 14)
    const bestTargetRook2 = sim.selectBestAttackTarget(rook2, [sim.enemyKing, weakPawn], 22);
    // Rook 2 (Sweeper) must prioritize the killable low-HP blocker!
    expect(bestTargetRook2.uid).toBe('enemy_pawn');
  });

  it('15. Knight Royal Fork: Knight seeks jump square that threatens King and Queen simultaneously', () => {
    const sim = new GameSim(1515);
    // Enemy King at (4, 16), Enemy Queen at (4, 14)
    const queen = {
      uid: 'enemy_queen',
      defId: 'piece.queen',
      pieceType: 'queen' as const,
      owner: 'enemy' as const,
      col: 4,
      row: 14,
      hp: 150,
      maxHp: 280,
      moveCooldown: 10,
      attackCooldown: 10
    };
    sim.pieces.push(queen);

    // Player Knight at (1, 13)
    // From (1, 13), one jump is (2, 15).
    // From (2, 15), Knight attacks King at (4, 16) [dx=2, dy=1] and Queen at (4, 14) [dx=2, dy=1]!
    const knight = {
      uid: 'tactical_knight',
      defId: 'piece.knight',
      pieceType: 'knight' as const,
      owner: 'player' as const,
      col: 1,
      row: 13,
      hp: 110,
      maxHp: 110,
      moveCooldown: 0,
      attackCooldown: 10
    };
    sim.pieces.push(knight);

    sim.step();

    // Knight must have selected the Royal Fork square (col 2, row 15)!
    expect(knight.col).toBe(2);
    expect(knight.row).toBe(15);
  });

  it('Bot AI chooses another affordable card while its Queen is active', () => {
    const sim = new GameSim(1516);
    const bot = new BotAI('enemy', 'nightmare');
    bot.openingDelay = 0;
    sim.enemy.essence = 100;
    sim.enemy.cooldowns['piece.queen'] = 0;
    sim.pieces.push({
      uid: 'active_enemy_queen',
      defId: 'piece.queen',
      pieceType: 'queen',
      owner: 'enemy',
      col: 1,
      row: 10,
      hp: 280,
      maxHp: 280,
      moveCooldown: 10,
      attackCooldown: 10
    });

    const intent = bot.update(sim);

    expect(intent).not.toBeNull();
    expect(intent?.cardId).not.toBe('piece.queen');
  });
});
