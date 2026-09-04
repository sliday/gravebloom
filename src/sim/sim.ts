import {
  ActivePiece,
  DeployIntent,
  GameSnapshot,
  KingMoveIntent,
  PlayerId,
  PlayerState,
  SimEvent
} from './types';
import { CHESS_PIECES, DECK_PIECES } from './units';
import {
  BOARD_COLS,
  BOARD_ROWS,
  isInsideBoard,
  getChebyshevDistance,
  getLegalDeploymentCells,
  getLegalKingMoves,
  getKnightLTargets,
  getPawnDiagonalAttacks,
  castChessRays,
  PLAYER_HALF_ROWS,
  ENEMY_HALF_ROWS
} from './board';

export class SimplePRNG {
  private seed: number;
  constructor(seed = 12345) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

export class GameSim {
  public tick = 0;
  public matchTime = 0;
  public matchDuration = 180;
  public overtimeDuration = 60;
  public isOvertime = false;
  public isGameOver = false;
  public winner?: PlayerId | 'draw';

  public player: PlayerState;
  public enemy: PlayerState;

  public playerKing: ActivePiece;
  public enemyKing: ActivePiece;
  public pieces: ActivePiece[] = [];

  public pendingIntents: DeployIntent[] = [];
  public events: SimEvent[] = [];
  public eventLog: SimEvent[] = [];

  private pieceIdCounter = 0;
  public prng: SimplePRNG;

  constructor(seed = 42) {
    this.prng = new SimplePRNG(seed);

    this.player = {
      id: 'player',
      kingHp: 200,
      maxKingHp: 200,
      essence: 35,
      maxEssence: 100,
      deck: [...DECK_PIECES],
      cooldowns: Object.fromEntries(DECK_PIECES.map((id) => [id, 0]))
    };

    this.enemy = {
      id: 'enemy',
      kingHp: 200,
      maxKingHp: 200,
      essence: 35,
      maxEssence: 100,
      deck: [...DECK_PIECES],
      cooldowns: Object.fromEntries(DECK_PIECES.map((id) => [id, 0]))
    };

    // On-board Kings
    this.playerKing = {
      uid: 'king_player',
      defId: 'piece.king',
      pieceType: 'king',
      owner: 'player',
      col: 4,
      row: 1,
      hp: 200,
      maxHp: 200,
      moveCooldown: 0,
      attackCooldown: 0
    };

    this.enemyKing = {
      uid: 'king_enemy',
      defId: 'piece.king',
      pieceType: 'king',
      owner: 'enemy',
      col: 4,
      row: 16,
      hp: 200,
      maxHp: 200,
      moveCooldown: 0,
      attackCooldown: 0
    };
  }

  public addIntent(intent: DeployIntent): boolean {
    if (this.isGameOver) return false;
    this.pendingIntents.push(intent);
    return true;
  }

  public moveKing(playerId: PlayerId, targetCol: number, targetRow: number): boolean {
    if (this.isGameOver) return false;
    const king = playerId === 'player' ? this.playerKing : this.enemyKing;
    if (king.hp <= 0) return false;
    if (!isInsideBoard(targetCol, targetRow)) return false;

    // King moves 1 square in all 8 directions strictly within friendly half
    const allowedRows = playerId === 'player' ? PLAYER_HALF_ROWS : ENEMY_HALF_ROWS;
    if (!allowedRows.includes(targetRow)) return false;

    const dist = getChebyshevDistance(king, { col: targetCol, row: targetRow });
    if (dist !== 1) return false;

    // Square cannot be occupied by ANY piece (pieces must not overlap)
    if (this.getPieceAt(targetCol, targetRow) !== undefined) return false;

    const fromCol = king.col;
    const fromRow = king.row;
    king.col = targetCol;
    king.row = targetRow;

    this.events.push({
      type: 'king_move',
      playerId,
      fromCol,
      fromRow,
      toCol: targetCol,
      toRow: targetRow
    });

    return true;
  }

  public step(): SimEvent[] {
    if (this.isGameOver) return [];
    this.events = [];
    this.tick++;
    const dt = 0.1; // 10 Hz
    this.matchTime += dt;

    // 1. Timer check
    this.updateMatchTimer();

    // 2. Economy
    this.updateEconomy(dt);

    // 3. Process Deploy Intents
    this.processIntents();

    // 4. Update Pieces strictly by chess rules
    this.updatePiecesStrictChess(dt);

    // 5. King Autonomous Evasion & Self-Defense
    this.updateKings(dt);

    // 6. Cleanup Dead Pieces
    this.cleanupDeadPieces();

    // 7. Check Game Over
    this.checkWinConditions();

    for (const ev of this.events) {
      this.eventLog.push(ev);
    }

    return this.events;
  }

  public stepSeconds(seconds: number): SimEvent[] {
    const totalTicks = Math.round(seconds * 10);
    const allEvents: SimEvent[] = [];
    for (let i = 0; i < totalTicks; i++) {
      if (this.isGameOver) break;
      const evs = this.step();
      allEvents.push(...evs);
    }
    return allEvents;
  }

  private updateMatchTimer(): void {
    const matchTicks = this.matchDuration * 10;
    const overtimeTicks = (this.matchDuration + this.overtimeDuration) * 10;

    if (!this.isOvertime && this.tick >= matchTicks) {
      if (this.playerKing.hp === this.enemyKing.hp) {
        this.isOvertime = true;
        this.events.push({ type: 'overtime_start' });
      } else {
        this.isGameOver = true;
        this.winner = this.playerKing.hp > this.enemyKing.hp ? 'player' : 'enemy';
        this.events.push({
          type: 'game_over',
          winner: this.winner,
          reason: 'Time expired: King health victory'
        });
      }
    } else if (this.isOvertime && this.tick >= overtimeTicks) {
      this.isGameOver = true;
      if (this.playerKing.hp === this.enemyKing.hp) {
        this.winner = 'draw';
      } else {
        this.winner = this.playerKing.hp > this.enemyKing.hp ? 'player' : 'enemy';
      }
      this.events.push({
        type: 'game_over',
        winner: this.winner,
        reason: 'Overtime expired'
      });
    }
  }

  private updateEconomy(dt: number): void {
    const regenRate = this.isOvertime ? 8.0 : 4.0;
    this.player.essence = Math.min(this.player.maxEssence, this.player.essence + regenRate * dt);
    this.enemy.essence = Math.min(this.enemy.maxEssence, this.enemy.essence + regenRate * dt);

    for (const card of this.player.deck) {
      if (this.player.cooldowns[card] > 0) {
        this.player.cooldowns[card] = Math.max(0, this.player.cooldowns[card] - dt);
      }
    }
    for (const card of this.enemy.deck) {
      if (this.enemy.cooldowns[card] > 0) {
        this.enemy.cooldowns[card] = Math.max(0, this.enemy.cooldowns[card] - dt);
      }
    }
  }

  private processIntents(): void {
    const intentsToRun = [...this.pendingIntents];
    this.pendingIntents = [];

    for (const intent of intentsToRun) {
      this.deployPiece(intent.playerId, intent.cardId, intent.col, intent.row);
    }
  }

  public deployPiece(
    playerId: PlayerId,
    cardId: string,
    col: number,
    row: number
  ): boolean {
    const def = CHESS_PIECES[cardId];
    if (!def) return false;

    const pState = playerId === 'player' ? this.player : this.enemy;

    if (pState.essence < def.cost) return false;
    if ((pState.cooldowns[cardId] ?? 0) > 0) return false;
    if (!isInsideBoard(col, row)) return false;

    // Must be on player's half of the board
    const legalCells = getLegalDeploymentCells(playerId);
    const isLegal = legalCells.some((c) => c.col === col && c.row === row);
    if (!isLegal) return false;

    // Square cannot be occupied by ANY piece (pieces must not overlap)
    if (this.getPieceAt(col, row) !== undefined) return false;

    // Queen limit: max 1 active Queen per player
    if (def.pieceType === 'queen') {
      const activeQueen = this.pieces.some(
        (p) => p.owner === playerId && p.pieceType === 'queen' && p.hp > 0
      );
      if (activeQueen) return false;
    }

    pState.essence -= def.cost;
    pState.cooldowns[cardId] = def.cooldown;

    const uid = `${cardId}_${++this.pieceIdCounter}`;

    const piece: ActivePiece = {
      uid,
      defId: def.id,
      pieceType: def.pieceType,
      owner: playerId,
      col,
      row,
      hp: def.hp,
      maxHp: def.hp,
      moveCooldown: def.moveInterval,
      attackCooldown: 0
    };

    this.pieces.push(piece);

    this.events.push({
      type: 'deploy',
      playerId,
      defId: def.id,
      col,
      row,
      uid
    });

    return true;
  }

  // Helper to check cell state on the board
  private getCellState(col: number, row: number, viewerOwner: PlayerId): 'empty' | 'friendly' | 'enemy' {
    const allPieces = [...this.pieces, this.playerKing, this.enemyKing];
    const piece = allPieces.find((p) => p.col === col && p.row === row && p.hp > 0);
    if (!piece) return 'empty';
    return piece.owner === viewerOwner ? 'friendly' : 'enemy';
  }

  // Find piece by coordinates
  public getPieceAt(col: number, row: number): ActivePiece | undefined {
    const allPieces = [...this.pieces, this.playerKing, this.enemyKing];
    return allPieces.find((p) => p.col === col && p.row === row && p.hp > 0);
  }

  // Helper to check if a piece can attack a given target strictly by chess rules
  public canPieceAttackTarget(piece: ActivePiece, target: ActivePiece): boolean {
    const fwd: 1 | -1 = piece.owner === 'player' ? 1 : -1;
    if (piece.pieceType === 'pawn') {
      const atks = getPawnDiagonalAttacks(piece.col, piece.row, fwd);
      return atks.some((a) => a.col === target.col && a.row === target.row);
    }
    if (piece.pieceType === 'knight') {
      const jumps = getKnightLTargets(piece.col, piece.row);
      return jumps.some((j) => j.col === target.col && j.row === target.row);
    }
    if (piece.pieceType === 'rook') {
      if (piece.col !== target.col && piece.row !== target.row) return false;
      const rays = castChessRays(piece.col, piece.row, [[0, 1], [0, -1], [1, 0], [-1, 0]], (c, r) => this.getCellState(c, r, piece.owner));
      return rays.some((r) => r.hitPiece && r.hitPiece.col === target.col && r.hitPiece.row === target.row);
    }
    if (piece.pieceType === 'bishop') {
      if (Math.abs(piece.col - target.col) !== Math.abs(piece.row - target.row)) return false;
      const rays = castChessRays(piece.col, piece.row, [[1, 1], [1, -1], [-1, 1], [-1, -1]], (c, r) => this.getCellState(c, r, piece.owner));
      return rays.some((r) => r.hitPiece && r.hitPiece.col === target.col && r.hitPiece.row === target.row);
    }
    if (piece.pieceType === 'queen') {
      const rays = castChessRays(piece.col, piece.row, [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], (c, r) => this.getCellState(c, r, piece.owner));
      return rays.some((r) => r.hitPiece && r.hitPiece.col === target.col && r.hitPiece.row === target.row);
    }
    if (piece.pieceType === 'king') {
      return getChebyshevDistance(piece, target) === 1;
    }
    return false;
  }

  // Tactical Target Selection across all piece types (Dual Rook split, King assassination, Bounty kills, Anti-Flank)
  public selectBestAttackTarget(
    attacker: ActivePiece,
    candidates: ActivePiece[],
    attackDamage: number
  ): ActivePiece {
    if (candidates.length === 1) return candidates[0];

    let bestTarget = candidates[0];
    let bestScore = -999999;

    const friendlyRooks = this.pieces.filter(
      (p) => p.owner === attacker.owner && p.pieceType === 'rook' && p.hp > 0
    );
    const hasDualRooks = friendlyRooks.length >= 2;
    friendlyRooks.sort((a, b) => a.uid.localeCompare(b.uid));
    const isSiegeRook = hasDualRooks && friendlyRooks[0].uid === attacker.uid;
    const isSweeperRook = hasDualRooks && !isSiegeRook;

    for (const target of candidates) {
      let score = 0;
      const isKing = target.pieceType === 'king';
      const isKillable = target.hp <= attackDamage;

      // 1. One-hit kill bounty priority (removes threat + awards essence)
      if (isKillable && !isKing) {
        score += 2000;
        if (target.pieceType === 'queen') score += 500;
        else if (target.pieceType === 'rook') score += 300;
        else if (target.pieceType === 'bishop' || target.pieceType === 'knight') score += 200;
      }

      // 2. Dual Rook specialization (Siege Anchor vs Sweeper / Executioner)
      if (attacker.pieceType === 'rook') {
        if (isSiegeRook) {
          // Siege Anchor: focus on King & high-threat pieces
          if (isKing) score += 3000;
          else if (target.pieceType === 'queen') score += 1800;
          else if (target.pieceType === 'rook') score += 1200;
          else score += 100 - target.hp;
        } else if (isSweeperRook) {
          // Sweeper / Executioner: prioritizes lowest HP and non-king targets
          if (!isKing) score += 2500 - target.hp * 10;
          else score += 400; // Attacks King only if no blockers exist
        } else {
          // Solo Rook: King first, then low HP
          if (isKing) score += 2500;
          else score += 1000 - target.hp;
        }
      } else if (attacker.pieceType === 'knight') {
        // Knight: King assassination, high-value backline picks
        if (isKing) score += 3000;
        else if (target.pieceType === 'queen') score += 1800;
        else if (target.pieceType === 'rook') score += 1200;
        else if (target.pieceType === 'bishop') score += 800;
        else score += 400 - target.hp;
      } else if (attacker.pieceType === 'bishop') {
        // Bishop: Anti-Knight sniper & Anti-Queen threat neutralization
        if (target.pieceType === 'knight') score += 1800;
        else if (target.pieceType === 'queen') score += 1600;
        else if (isKing) score += 1400;
        else if (target.pieceType === 'rook') score += 1000;
        else score += 300 - target.hp;
      } else if (attacker.pieceType === 'queen') {
        // Queen: Checkmate if King wounded, otherwise eliminate highest threat
        if (isKing && target.hp <= 60) score += 4000;
        else if (target.pieceType === 'queen') score += 2000;
        else if (isKing) score += 1500;
        else if (target.pieceType === 'rook') score += 1200;
        else score += 500 - target.hp;
      } else if (attacker.pieceType === 'pawn') {
        // Pawn: Lowest HP for kill bounty, or higher tier
        if (isKing) score += 1000;
        else if (target.pieceType === 'queen') score += 800;
        else if (target.pieceType === 'knight' || target.pieceType === 'bishop') score += 600;
        else score += 300 - target.hp;
      }

      // 3. Flanking coordination bonus (+25% damage when multiple friendly units attack same target)
      const sameColorAllies = this.pieces.filter(
        (p) => p.owner === attacker.owner && p.uid !== attacker.uid && p.hp > 0 && this.canPieceAttackTarget(p, target)
      );
      if (sameColorAllies.length > 0) {
        score += 250;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget;
  }

  // Strict Chess Movement & Attack Execution
  private updatePiecesStrictChess(dt: number): void {
    for (const piece of this.pieces) {
      if (piece.hp <= 0) continue;
      const def = CHESS_PIECES[piece.defId];
      if (!def) continue;

      const forwardDir: 1 | -1 = piece.owner === 'player' ? 1 : -1;
      const enemyKing = piece.owner === 'player' ? this.enemyKing : this.playerKing;

      // ==========================================
      // PHASE 1: CHECK ATTACK (Strict Chess Capture)
      // ==========================================
      let attackTarget: ActivePiece | undefined = undefined;
      const candidates: ActivePiece[] = [];

      if (piece.pieceType === 'pawn') {
        // Pawn attacks STRICTLY diagonally forward by 1 square
        const diagonalTargets = getPawnDiagonalAttacks(piece.col, piece.row, forwardDir);
        for (const t of diagonalTargets) {
          const victim = this.getPieceAt(t.col, t.row);
          if (victim && victim.owner !== piece.owner && victim.hp > 0) {
            candidates.push(victim);
          }
        }
      } else if (piece.pieceType === 'knight') {
        // Knight attacks STRICTLY on 8 L-jump squares (jumping over any piece)
        const jumps = getKnightLTargets(piece.col, piece.row);
        for (const j of jumps) {
          const victim = this.getPieceAt(j.col, j.row);
          if (victim && victim.owner !== piece.owner && victim.hp > 0) {
            candidates.push(victim);
          }
        }
      } else if (piece.pieceType === 'rook') {
        // Rook attacks STRICTLY along orthogonal ranks and files (blocked by first piece)
        const rays = castChessRays(
          piece.col,
          piece.row,
          [[0, 1], [0, -1], [1, 0], [-1, 0]],
          (c, r) => this.getCellState(c, r, piece.owner)
        );
        for (const ray of rays) {
          if (ray.hitPiece && ray.hitPiece.isEnemy) {
            const victim = this.getPieceAt(ray.hitPiece.col, ray.hitPiece.row);
            if (victim && victim.hp > 0 && !candidates.some((c) => c.uid === victim.uid)) {
              candidates.push(victim);
            }
          }
        }
      } else if (piece.pieceType === 'bishop') {
        // Bishop attacks STRICTLY along diagonal rays (blocked by first piece)
        const rays = castChessRays(
          piece.col,
          piece.row,
          [[1, 1], [1, -1], [-1, 1], [-1, -1]],
          (c, r) => this.getCellState(c, r, piece.owner)
        );
        for (const ray of rays) {
          if (ray.hitPiece && ray.hitPiece.isEnemy) {
            const victim = this.getPieceAt(ray.hitPiece.col, ray.hitPiece.row);
            if (victim && victim.hp > 0 && !candidates.some((c) => c.uid === victim.uid)) {
              candidates.push(victim);
            }
          }
        }
      } else if (piece.pieceType === 'queen') {
        // Queen attacks along ranks, files, and diagonals (blocked by first piece)
        const rays = castChessRays(
          piece.col,
          piece.row,
          [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
          (c, r) => this.getCellState(c, r, piece.owner)
        );
        for (const ray of rays) {
          if (ray.hitPiece && ray.hitPiece.isEnemy) {
            const victim = this.getPieceAt(ray.hitPiece.col, ray.hitPiece.row);
            if (victim && victim.hp > 0 && !candidates.some((c) => c.uid === victim.uid)) {
              candidates.push(victim);
            }
          }
        }
      }

      if (candidates.length > 0) {
        attackTarget = this.selectBestAttackTarget(piece, candidates, def.attackDamage);
      }

      // If an enemy piece is in attack line of sight: EXECUTE CHESS ATTACK!
      if (attackTarget) {
        if (piece.attackCooldown > 0) {
          piece.attackCooldown -= dt;
        }
        if (piece.attackCooldown <= 0) {
          // 1. Flanking Bonus Check: strictly requires >= 2 friendly pieces OF THE SAME COLOR attacking the target!
          const sameColorAttackers = [...this.pieces, piece.owner === 'player' ? this.playerKing : this.enemyKing].filter(
            (other) => other.owner === piece.owner && other.hp > 0 && this.canPieceAttackTarget(other, attackTarget!)
          );
          const isFlanked = sameColorAttackers.length >= 2;

          let finalDmg = def.attackDamage;
          if (isFlanked) {
            finalDmg = Math.round(finalDmg * 1.25); // +25% Flanking Bonus!
          }

          // 2. Connected Pawns: 20% damage reduction for supported pawn
          if (attackTarget.pieceType === 'pawn') {
            const victimFwd = attackTarget.owner === 'player' ? 1 : -1;
            const hasPawnChain = this.pieces.some(
              (p) =>
                p.owner === attackTarget!.owner &&
                p.pieceType === 'pawn' &&
                p.hp > 0 &&
                p.uid !== attackTarget!.uid &&
                Math.abs(p.col - attackTarget!.col) === 1 &&
                (p.row === attackTarget!.row - victimFwd || p.row === attackTarget!.row + victimFwd)
            );
            if (hasPawnChain) {
              finalDmg = Math.round(finalDmg * 0.8);
            }
          }

          const wasAlive = attackTarget.hp > 0;
          attackTarget.hp = Math.max(0, attackTarget.hp - finalDmg);
          attackTarget.lastDamageTakenTime = this.matchTime;
          piece.attackCooldown = def.attackInterval;

          // 3. Capture Bounties (P+5 / N,B+10 / R+15 / Q+25 essence)
          if (wasAlive && attackTarget.hp <= 0 && attackTarget.pieceType !== 'king') {
            let bounty = 5;
            if (attackTarget.pieceType === 'knight' || attackTarget.pieceType === 'bishop') bounty = 10;
            else if (attackTarget.pieceType === 'rook') bounty = 15;
            else if (attackTarget.pieceType === 'queen') bounty = 25;

            const killerPlayer = piece.owner === 'player' ? this.player : this.enemy;
            killerPlayer.essence = Math.min(killerPlayer.maxEssence, killerPlayer.essence + bounty);

            this.events.push({
              type: 'bounty',
              playerId: piece.owner,
              bounty,
              pieceType: attackTarget.pieceType,
              col: attackTarget.col,
              row: attackTarget.row
            });
          }

          if (attackTarget.pieceType === 'king') {
            const pState = attackTarget.owner === 'player' ? this.player : this.enemy;
            pState.kingHp = attackTarget.hp;
            this.events.push({
              type: 'king_damage',
              targetPlayerId: attackTarget.owner,
              damage: finalDmg,
              remainingHp: attackTarget.hp
            });
          }

          this.events.push({
            type: 'attack',
            attackerUid: piece.uid,
            targetUid: attackTarget.uid,
            col: attackTarget.col,
            row: attackTarget.row,
            damage: finalDmg,
            isFlanked
          });
        }
        continue; // Fighting target; do not move while attacking
      }

      // ==========================================
      // PHASE 2: CHECK MOVEMENT (Strict Chess Move)
      // ==========================================
      if (piece.moveCooldown > 0) {
        piece.moveCooldown -= dt;
      }

      if (piece.moveCooldown <= 0) {
        if (piece.pieceType === 'pawn') {
          // Strict Pawn Move: 1 square directly forward along file.
          // MUST BE EMPTY! If blocked by ANY piece, pawn cannot move forward.
          const fwdRow = piece.row + forwardDir;
          if (isInsideBoard(piece.col, fwdRow) && this.getPieceAt(piece.col, fwdRow) === undefined) {
            piece.row = fwdRow;
            piece.moveCooldown = def.moveInterval;

            // PAWN PROMOTION TO QUEEN AT ENEMY BACK ROW!
            if ((piece.owner === 'player' && piece.row >= BOARD_ROWS) || (piece.owner === 'enemy' && piece.row <= 1)) {
              piece.pieceType = 'queen';
              piece.defId = 'piece.queen';
              piece.maxHp = 280;
              piece.hp = Math.max(piece.hp, 200);

              this.events.push({
                type: 'pawn_promote',
                playerId: piece.owner,
                col: piece.col,
                row: piece.row,
                uid: piece.uid
              });
            }
          }
        } else if (piece.pieceType === 'knight') {
          // Strict Knight Move: Leaps in L-pattern with ROYAL FORK PRIORITY & PREDICTIVE INTERCEPTION
          const jumps = getKnightLTargets(piece.col, piece.row);
          const legalJumps = jumps.filter((j) => this.getPieceAt(j.col, j.row) === undefined);

          if (legalJumps.length > 0) {
            let bestJump = legalJumps[0];
            let bestScore = -999999;
            const enemyPieces = this.pieces.filter((p) => p.owner !== piece.owner && p.hp > 0);

            for (const j of legalJumps) {
              let score = 0;
              const futureAttacks = getKnightLTargets(j.col, j.row);

              // 1. Royal Fork / Multi-target Fork Evaluation from jump destination
              const threatenedEnemies: ActivePiece[] = [];
              if (futureAttacks.some((fa) => fa.col === enemyKing.col && fa.row === enemyKing.row)) {
                threatenedEnemies.push(enemyKing);
              }
              for (const ep of enemyPieces) {
                if (futureAttacks.some((fa) => fa.col === ep.col && fa.row === ep.row)) {
                  threatenedEnemies.push(ep);
                }
              }

              if (threatenedEnemies.length >= 2) {
                const hasKing = threatenedEnemies.some((t) => t.pieceType === 'king');
                const hasHeavy = threatenedEnemies.some((t) => t.pieceType === 'queen' || t.pieceType === 'rook');
                if (hasKing && hasHeavy) {
                  score += 1500; // Royal Fork (King + Queen/Rook fork)!
                } else if (hasKing) {
                  score += 800; // King fork!
                } else {
                  score += 500; // Dual piece fork!
                }
              } else if (threatenedEnemies.length === 1) {
                if (threatenedEnemies[0].pieceType === 'king') score += 400;
                else score += 200;
              }

              // 2. Predictive interception: check if an advancing enemy piece will step into our attack range
              for (const ep of enemyPieces) {
                const epFwd = ep.owner === 'player' ? 1 : -1;
                const futureRow = ep.row + epFwd;
                if (isInsideBoard(ep.col, futureRow)) {
                  if (futureAttacks.some((fa) => fa.col === ep.col && fa.row === futureRow)) {
                    score += 250;
                    break;
                  }
                }
              }

              // 3. Proximity to enemy King
              const distToKing = getChebyshevDistance(j, enemyKing);
              score += (16 - distToKing) * 15;

              if (score > bestScore) {
                bestScore = score;
                bestJump = j;
              }
            }

            if (this.getPieceAt(bestJump.col, bestJump.row) === undefined) {
              piece.col = bestJump.col;
              piece.row = bestJump.row;
              piece.moveCooldown = def.moveInterval;
            }
          }
        } else if (piece.pieceType === 'rook') {
          // Rook charges up to 8 open cells along unobstructed rank or file in one go!
          // With role specialization (Siege vs Sweeper) and predictive interception
          const rays = castChessRays(
            piece.col,
            piece.row,
            [[0, 1], [0, -1], [1, 0], [-1, 0]],
            (c, r) => this.getCellState(c, r, piece.owner)
          );

          const friendlyRooks = this.pieces.filter(
            (p) => p.owner === piece.owner && p.pieceType === 'rook' && p.hp > 0
          );
          const hasDualRooks = friendlyRooks.length >= 2;
          friendlyRooks.sort((a, b) => a.uid.localeCompare(b.uid));
          const isSiegeRook = hasDualRooks && friendlyRooks[0].uid === piece.uid;
          const isSweeperRook = hasDualRooks && !isSiegeRook;

          let bestMove: { col: number; row: number } | null = null;
          let bestScore = -999999;
          const enemyPieces = this.pieces.filter((p) => p.owner !== piece.owner && p.hp > 0);

          for (const ray of rays) {
            const maxStep = Math.min(8, ray.openCells.length);
            for (let s = 0; s < maxStep; s++) {
              const cell = ray.openCells[s];
              if (this.getPieceAt(cell.col, cell.row) !== undefined) continue;

              let score = 0;
              const distToKing = getChebyshevDistance(cell, enemyKing);

              if (isSweeperRook) {
                // Sweeper Rook: seeks out files/ranks with weak or advancing enemy blockers
                for (const ep of enemyPieces) {
                  if (cell.col === ep.col || cell.row === ep.row) {
                    score += 200 - ep.hp;
                  }
                }
                score += (16 - distToKing) * 20;
              } else {
                // Siege Rook / Solo Rook: primary focus is closing distance to King!
                score += (16 - distToKing) * 100;
                if (cell.col === enemyKing.col || cell.row === enemyKing.row) {
                  score += 50; // Aligns on King rank or file
                }
              }

              // Predictive check: align on file of an advancing enemy piece
              for (const ep of enemyPieces) {
                if (cell.col === ep.col) score += 150;
              }

              if (score > bestScore) {
                bestScore = score;
                bestMove = cell;
              }
            }
          }

          if (bestMove && this.getPieceAt(bestMove.col, bestMove.row) === undefined) {
            piece.col = bestMove.col;
            piece.row = bestMove.row;
            piece.moveCooldown = def.moveInterval;
          }
        } else if (piece.pieceType === 'bishop') {
          // Bishop Standoff AI: Attacks King from afar (distance >= 2), NEVER steps to distance <= 1!
          const rays = castChessRays(
            piece.col,
            piece.row,
            [[1, 1], [1, -1], [-1, 1], [-1, -1]],
            (c, r) => this.getCellState(c, r, piece.owner)
          );

          const curDistToKing = getChebyshevDistance(piece, enemyKing);
          let bestMove: { col: number; row: number } | null = null;

          // Case A: King is too close (distance <= 1) -> KITE! Retreat along diagonal to distance >= 2!
          if (curDistToKing <= 1) {
            let maxDist = curDistToKing;
            for (const ray of rays) {
              const maxStep = Math.min(8, ray.openCells.length);
              for (let s = 0; s < maxStep; s++) {
                const cell = ray.openCells[s];
                if (this.getPieceAt(cell.col, cell.row) === undefined) {
                  const d = getChebyshevDistance(cell, enemyKing);
                  if (d >= 2 && d > maxDist) {
                    maxDist = d;
                    bestMove = cell;
                  }
                }
              }
            }
          } else {
            // Case B: Move toward a diagonal that lines up with the King, but STRICTLY keep distance >= 2!
            let bestScore = -999;
            for (const ray of rays) {
              const maxStep = Math.min(8, ray.openCells.length);
              for (let s = 0; s < maxStep; s++) {
                const cell = ray.openCells[s];
                if (this.getPieceAt(cell.col, cell.row) === undefined) {
                  const d = getChebyshevDistance(cell, enemyKing);
                  // NEVER step into 1 cell distance of the King!
                  if (d <= 1) continue;

                  // High score for landing on an open diagonal with the King (sniper lock!)
                  const isOnDiagonalWithKing = Math.abs(cell.col - enemyKing.col) === Math.abs(cell.row - enemyKing.row);
                  let score = 100 - d;
                  if (isOnDiagonalWithKing) score += 200;

                  if (score > bestScore) {
                    bestScore = score;
                    bestMove = cell;
                  }
                }
              }
            }
          }

          if (bestMove && this.getPieceAt(bestMove.col, bestMove.row) === undefined) {
            piece.col = bestMove.col;
            piece.row = bestMove.row;
            piece.moveCooldown = def.moveInterval;
          }
        } else if (piece.pieceType === 'queen') {
          // Queen slides up to 8 cells along any unobstructed ray toward enemy King
          const rays = castChessRays(
            piece.col,
            piece.row,
            [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]],
            (c, r) => this.getCellState(c, r, piece.owner)
          );
          let bestMove: { col: number; row: number } | null = null;
          let bestDist = getChebyshevDistance(piece, enemyKing);

          for (const ray of rays) {
            const maxStep = Math.min(8, ray.openCells.length);
            for (let s = 0; s < maxStep; s++) {
              const cell = ray.openCells[s];
              if (this.getPieceAt(cell.col, cell.row) === undefined) {
                const d = getChebyshevDistance(cell, enemyKing);
                if (d < bestDist) {
                  bestDist = d;
                  bestMove = cell;
                }
              }
            }
          }

          if (bestMove && this.getPieceAt(bestMove.col, bestMove.row) === undefined) {
            piece.col = bestMove.col;
            piece.row = bestMove.row;
            piece.moveCooldown = def.moveInterval;
          }
        }
      }
    }
  }

  // Calculate danger score for a square
  private evaluateSquareDanger(col: number, row: number, threatOwner: PlayerId): number {
    let danger = 0;
    const fwdDir: 1 | -1 = threatOwner === 'player' ? 1 : -1;

    for (const p of this.pieces) {
      if (p.owner !== threatOwner || p.hp <= 0) continue;
      if (p.col === col && p.row === row) continue;

      const d = getChebyshevDistance({ col, row }, p);

      if (p.pieceType === 'pawn') {
        const attacks = getPawnDiagonalAttacks(p.col, p.row, fwdDir);
        if (attacks.some((a) => a.col === col && a.row === row)) {
          danger += 45;
        }
      } else if (p.pieceType === 'knight') {
        const jumps = getKnightLTargets(p.col, p.row);
        if (jumps.some((j) => j.col === col && j.row === row)) {
          danger += 40;
        }
      }

      if (p.pieceType === 'rook' || p.pieceType === 'queen') {
        if (p.col === col || p.row === row) {
          const dc = p.col === col ? 0 : col > p.col ? 1 : -1;
          const dr = p.row === row ? 0 : row > p.row ? 1 : -1;
          let blocked = false;
          let curC = p.col + dc;
          let curR = p.row + dr;
          while ((curC !== col || curR !== row) && isInsideBoard(curC, curR)) {
            if (this.getPieceAt(curC, curR)) {
              blocked = true;
              break;
            }
            curC += dc;
            curR += dr;
          }
          if (!blocked) danger += 50;
        }
      }

      if (p.pieceType === 'bishop' || p.pieceType === 'queen') {
        if (Math.abs(p.col - col) === Math.abs(p.row - row) && (p.col !== col || p.row !== row)) {
          const dc = col > p.col ? 1 : -1;
          const dr = row > p.row ? 1 : -1;
          let blocked = false;
          let curC = p.col + dc;
          let curR = p.row + dr;
          while ((curC !== col || curR !== row) && isInsideBoard(curC, curR)) {
            if (this.getPieceAt(curC, curR)) {
              blocked = true;
              break;
            }
            curC += dc;
            curR += dr;
          }
          if (!blocked) danger += 45;
        }
      }

      if (d <= 2) {
        danger += (3 - d) * 10;
      }
    }

    return danger;
  }

  private updateKings(dt: number): void {
    for (const king of [this.playerKing, this.enemyKing]) {
      if (king.hp <= 0) continue;

      if (king.moveCooldown > 0) {
        king.moveCooldown -= dt;
      }

      // KING TACTICAL EVASION:
      // Player's King avoids attackers, moving around our board (Rows 1-7) freely!
      if (king.moveCooldown <= 0) {
        const opponentId: PlayerId = king.owner === 'player' ? 'enemy' : 'player';
        const currentDanger = this.evaluateSquareDanger(king.col, king.row, opponentId);

        // Check if attackers near
        const nearbyThreats = this.pieces.filter(
          (p) => p.owner === opponentId && p.hp > 0 && getChebyshevDistance(king, p) <= 2
        );

        if (currentDanger > 0 || nearbyThreats.length > 0) {
          const moves = getLegalKingMoves(king.col, king.row);
          // King moves around our board territory freely!
          const allowedRows = king.owner === 'player' ? PLAYER_HALF_ROWS : ENEMY_HALF_ROWS;
          const territoryMoves = moves.filter((m) => allowedRows.includes(m.row));

          let bestEscape: { col: number; row: number } | null = null;
          let lowestDanger = currentDanger;

          for (const m of territoryMoves) {
            // Cannot step onto ANY piece (pieces must not overlap)
            if (this.getPieceAt(m.col, m.row) !== undefined) continue;

            let danger = this.evaluateSquareDanger(m.col, m.row, opponentId);
            // Shield seeking: friendly pieces adjacent to escape square provide shelter
            const friendlyDefenders = this.pieces.filter(
              (p) => p.owner === king.owner && p.hp > 0 && getChebyshevDistance(m, p) <= 1
            );
            danger -= friendlyDefenders.length * 8;

            if (danger < lowestDanger) {
              lowestDanger = danger;
              bestEscape = m;
            }
          }

          if (bestEscape) {
            this.moveKing(king.owner, bestEscape.col, bestEscape.row);
            king.moveCooldown = 0.7; // Evasion speed (runs away flexibly!)
          }
        }
      }

      if (king.attackCooldown > 0) {
        king.attackCooldown -= dt;
      }

      if (king.attackCooldown <= 0) {
        // Strike adjacent hostile piece (pick lowest HP to remove attacker fastest!)
        const hostiles = this.pieces.filter(
          (p) => p.owner !== king.owner && p.hp > 0 && getChebyshevDistance(king, p) <= 1
        );
        if (hostiles.length > 0) {
          hostiles.sort((a, b) => a.hp - b.hp);
          const hostile = hostiles[0];
          hostile.hp -= 30;
          hostile.lastDamageTakenTime = this.matchTime;
          king.attackCooldown = 1.0;

          this.events.push({
            type: 'attack',
            attackerUid: king.uid,
            targetUid: hostile.uid,
            col: hostile.col,
            row: hostile.row,
            damage: 30
          });
        }
      }
    }
  }

  private cleanupDeadPieces(): void {
    for (const p of this.pieces) {
      if (p.hp <= 0) {
        this.events.push({
          type: 'piece_death',
          uid: p.uid,
          defId: p.defId,
          col: p.col,
          row: p.row,
          owner: p.owner
        });
      }
    }
    this.pieces = this.pieces.filter((p) => p.hp > 0);
  }

  private checkWinConditions(): void {
    if (this.isGameOver) return;

    if (this.playerKing.hp <= 0 && this.enemyKing.hp <= 0) {
      this.isGameOver = true;
      this.winner = 'draw';
      this.events.push({ type: 'game_over', winner: 'draw', reason: 'Both Kings fell!' });
    } else if (this.playerKing.hp <= 0) {
      this.isGameOver = true;
      this.winner = 'enemy';
      this.events.push({ type: 'game_over', winner: 'enemy', reason: 'Your King has fallen! Checkmate.' });
    } else if (this.enemyKing.hp <= 0) {
      this.isGameOver = true;
      this.winner = 'player';
      this.events.push({ type: 'game_over', winner: 'player', reason: 'Enemy King captured! Victory!' });
    }
  }

  public getSnapshot(): GameSnapshot {
    return {
      tick: this.tick,
      timeSeconds: this.matchTime,
      isOvertime: this.isOvertime,
      isGameOver: this.isGameOver,
      winner: this.winner,
      player: {
        ...this.player,
        cooldowns: { ...this.player.cooldowns },
        deck: [...this.player.deck]
      },
      enemy: {
        ...this.enemy,
        cooldowns: { ...this.enemy.cooldowns },
        deck: [...this.enemy.deck]
      },
      playerKing: { ...this.playerKing },
      enemyKing: { ...this.enemyKing },
      pieces: this.pieces.map((p) => ({ ...p })),
      recentEvents: [...this.events]
    };
  }

  public applySnapshot(snap: GameSnapshot): void {
    this.tick = snap.tick;
    this.matchTime = snap.timeSeconds;
    this.isOvertime = snap.isOvertime;
    this.isGameOver = snap.isGameOver;
    this.winner = snap.winner;
    this.player = {
      ...snap.player,
      cooldowns: { ...snap.player.cooldowns },
      deck: [...snap.player.deck]
    };
    this.enemy = {
      ...snap.enemy,
      cooldowns: { ...snap.enemy.cooldowns },
      deck: [...snap.enemy.deck]
    };
    this.playerKing = { ...snap.playerKing };
    this.enemyKing = { ...snap.enemyKing };
    this.pieces = snap.pieces.map((p) => ({ ...p }));
  }
}
