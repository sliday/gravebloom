import { ActivePiece, CellCoord, GameSnapshot, PlayerId, SimEvent, UnitType } from '../sim/types';
import { CHESS_PIECES } from '../sim/units';
import { BOARD_COLS, BOARD_ROWS, getChebyshevDistance, getLegalKingMoves, getKnightLTargets } from '../sim/board';
import { sprites } from './sprites';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface CombatStrike {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  pieceType: UnitType;
  progress: number;
  duration: number;
  damage: number;
}

interface PieceDisplay {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  prevX: number;
  prevY: number;
  isJumping?: boolean;
  jumpProgress?: number;
  hitFlash?: number; // 0..1 flash white on hit
}

interface TrailLine {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  pieceType: UnitType;
  isKnightL?: boolean;
  cornerX?: number;
  cornerY?: number;
  alpha: number;
}

interface PieceBurst {
  x: number;
  y: number;
  color: string;
  pieceType: UnitType;
  kind: 'deploy' | 'death';
  progress: number;
  duration: number;
}

export const PIECE_EFFECT_PROFILES: Record<UnitType, {
  signature: string;
  deployDuration: number;
  strikeDuration: number;
  particleCount: number;
}> = {
  pawn: { signature: 'seed', deployDuration: 0.65, strikeDuration: 0.28, particleCount: 8 },
  knight: { signature: 'l-rune', deployDuration: 0.78, strikeDuration: 0.46, particleCount: 10 },
  bishop: { signature: 'prism', deployDuration: 0.82, strikeDuration: 0.38, particleCount: 12 },
  rook: { signature: 'bastion', deployDuration: 0.9, strikeDuration: 0.54, particleCount: 14 },
  queen: { signature: 'bloom', deployDuration: 1.1, strikeDuration: 0.68, particleCount: 18 },
  king: { signature: 'ward', deployDuration: 0.95, strikeDuration: 0.58, particleCount: 16 }
};

interface PromotionCoronation {
  x: number;
  y: number;
  progress: number;
  duration: number;
  color: string;
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private width = 0;
  private height = 0;
  private dpr = 1;

  // Board layout metrics
  private boardX = 0;
  private boardY = 0;
  private boardW = 0;
  private boardH = 0;
  private cellSize = 0;

  // Visual effects
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private combatStrikes: CombatStrike[] = [];
  private moveTrails: TrailLine[] = [];
  private pieceBursts: PieceBurst[] = [];
  private coronations: PromotionCoronation[] = [];
  private screenFlash = 0;

  // Piece interpolated display positions (smooth movement)
  private pieceDisplays: Map<string, PieceDisplay> = new Map();

  // Selection & King movement state
  public isKingSelected = false;
  public isFlipped = false; // When true (Black / Guest player), board is flipped so player field is at bottom!
  public legalKingMoves: CellCoord[] = [];
  public selectedPieceId: string | null = null;
  public highlightedCells: CellCoord[] = [];
  public previewCell: CellCoord | null = null;

  private animTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  public resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.floor(parent.clientWidth || parent.getBoundingClientRect().width);
    this.height = Math.floor(parent.clientHeight || parent.getBoundingClientRect().height);

    if (this.width <= 0 || this.height <= 0) return;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.ctx.resetTransform?.();
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.imageSmoothingEnabled = false;

    // Strict vertical margin so rows 1 through 14 are never cut off by controls
    const maxCellW = (this.width - 24) / BOARD_COLS;
    const maxCellH = (this.height - 32) / BOARD_ROWS;
    this.cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    this.boardW = this.cellSize * BOARD_COLS;
    this.boardH = this.cellSize * BOARD_ROWS;
    this.boardX = Math.floor((this.width - this.boardW) / 2);
    this.boardY = Math.floor((this.height - this.boardH) / 2);
  }

  public getPointerPos(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  public screenToCell(screenX: number, screenY: number): CellCoord | null {
    if (
      screenX < this.boardX ||
      screenX >= this.boardX + this.boardW ||
      screenY < this.boardY ||
      screenY >= this.boardY + this.boardH
    ) {
      return null;
    }

    const screenCol = Math.floor((screenX - this.boardX) / this.cellSize);
    const rowFromTop = Math.floor((screenY - this.boardY) / this.cellSize);
    const screenRow = BOARD_ROWS - rowFromTop;

    const col = this.isFlipped ? (BOARD_COLS - 1 - screenCol) : screenCol;
    const row = this.isFlipped ? (BOARD_ROWS + 1 - screenRow) : screenRow;

    if (col >= 0 && col < BOARD_COLS && row >= 1 && row <= BOARD_ROWS) {
      return { col, row };
    }
    return null;
  }

  public cellToScreen(col: number, row: number): { x: number; y: number } {
    const effectiveCol = this.isFlipped ? (BOARD_COLS - 1 - col) : col;
    const effectiveRow = this.isFlipped ? (BOARD_ROWS + 1 - row) : row;
    const rowFromTop = BOARD_ROWS - effectiveRow;
    return {
      x: this.boardX + effectiveCol * this.cellSize + this.cellSize / 2,
      y: this.boardY + rowFromTop * this.cellSize + this.cellSize / 2
    };
  }

  public pushEvents(events: SimEvent[], snap?: GameSnapshot): void {
    for (const ev of events) {
      if (ev.type === 'deploy') {
        const pos = this.cellToScreen(ev.col, ev.row);
        const def = CHESS_PIECES[ev.defId];
        const pieceType = def?.pieceType ?? 'pawn';
        const color = ev.playerId === 'player' ? '#39D0FF' : '#FF4FD8';
        this.spawnFloatingText(pos.x, pos.y - this.cellSize * 0.78, `+${def?.name.toUpperCase() ?? 'PIECE'}`, color);
        this.spawnPieceBurst(pos.x, pos.y, pieceType, color, 'deploy');
        this.spawnHitParticles(pos.x, pos.y, color, PIECE_EFFECT_PROFILES[pieceType].particleCount);
      } else if (ev.type === 'attack') {
        const targetPos = this.cellToScreen(ev.col, ev.row);

        // Find attacker position
        let attackerPos = targetPos;
        let attackerPieceType: UnitType = 'pawn';
        let attackerOwner: PlayerId = 'player';

        if (snap) {
          const allPieces = [...snap.pieces, snap.playerKing, snap.enemyKing];
          const atk = allPieces.find((p) => p.uid === ev.attackerUid);
          if (atk) {
            attackerPos = this.getPieceRenderPos(atk);
            attackerPieceType = atk.pieceType;
            attackerOwner = atk.owner;
          }
          // Trigger hit flash on victim
          const victimDisp = this.pieceDisplays.get(ev.targetUid);
          if (victimDisp) {
            victimDisp.hitFlash = 1.0;
          }
        }

        const color = attackerOwner === 'player' ? '#39D0FF' : '#FF4FD8';

        // Spawn bold combat strike animation
        this.combatStrikes.push({
          fromX: attackerPos.x,
          fromY: attackerPos.y,
          toX: targetPos.x,
          toY: targetPos.y,
          color,
          pieceType: attackerPieceType,
          progress: 0,
          duration: PIECE_EFFECT_PROFILES[attackerPieceType].strikeDuration,
          damage: ev.damage
        });

        this.spawnHitParticles(targetPos.x, targetPos.y, '#FFE600', 12);
        if (ev.isFlanked) {
          this.spawnFloatingText(targetPos.x, targetPos.y - 18, `FLANKED! -${ev.damage}`, '#FFE600');
        } else {
          this.spawnFloatingText(targetPos.x, targetPos.y - 16, `-${ev.damage}`, '#FFE600');
        }
      } else if (ev.type === 'piece_death') {
        const pos = this.cellToScreen(ev.col, ev.row);
        const pieceType = CHESS_PIECES[ev.defId]?.pieceType ?? 'pawn';
        const color = ev.owner === 'player' ? '#39D0FF' : '#FF4FD8';
        this.spawnPieceBurst(pos.x, pos.y, pieceType, color, 'death');
        this.spawnHitParticles(pos.x, pos.y, color, PIECE_EFFECT_PROFILES[pieceType].particleCount);
      } else if (ev.type === 'bounty') {
        const pos = this.cellToScreen(ev.col, ev.row);
        this.spawnHitParticles(pos.x, pos.y, '#FFE600', 16);
        this.spawnFloatingText(pos.x, pos.y - 20, `+${ev.bounty} ESSENCE`, '#FFE600');
      } else if (ev.type === 'king_move') {
        const fromPos = this.cellToScreen(ev.fromCol, ev.fromRow);
        const toPos = this.cellToScreen(ev.toCol, ev.toRow);
        const color = ev.playerId === 'player' ? '#FFE600' : '#FF4757';

        this.moveTrails.push({
          fromX: fromPos.x,
          fromY: fromPos.y,
          toX: toPos.x,
          toY: toPos.y,
          color,
          pieceType: 'king',
          alpha: 1.0
        });

        this.spawnFloatingText(toPos.x, toPos.y - this.cellSize * 0.7, 'KING EVADES!', color);
        this.spawnPieceBurst(toPos.x, toPos.y, 'king', color, 'deploy');
        this.spawnHitParticles(toPos.x, toPos.y, color, 14);
      } else if (ev.type === 'king_damage') {
        const targetRow = ev.targetPlayerId === 'player' ? 1 : BOARD_ROWS;
        const pos = this.cellToScreen(4, targetRow);
        this.spawnHitParticles(pos.x, pos.y, '#FF4757', 24);
        this.spawnFloatingText(pos.x, pos.y - 18, `KING HIT! -${ev.damage}`, '#FF4757');
        if (ev.targetPlayerId === 'player') {
          this.screenFlash = 0.8;
        }
      } else if (ev.type === 'pawn_promote') {
        const pos = this.cellToScreen(ev.col, ev.row);
        const color = ev.playerId === 'player' ? '#FFE600' : '#FF4FD8';
        this.coronations.push({
          x: pos.x,
          y: pos.y,
          progress: 0,
          duration: 1.2,
          color
        });
        this.spawnHitParticles(pos.x, pos.y, color, 30);
        this.spawnFloatingText(pos.x, pos.y - 24, '♛ QUEEN CORONATION! ♛', color);
        this.screenFlash = 0.5;
      }
    }
  }

  private spawnPieceBurst(
    x: number,
    y: number,
    pieceType: UnitType,
    color: string,
    kind: 'deploy' | 'death'
  ): void {
    const profile = PIECE_EFFECT_PROFILES[pieceType];
    this.pieceBursts.push({
      x,
      y,
      color,
      pieceType,
      kind,
      progress: 0,
      duration: kind === 'deploy' ? profile.deployDuration : profile.deployDuration * 0.8
    });
  }

  private spawnHitParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2.5 + Math.random() * 2.5,
        alpha: 1.0,
        life: 0,
        maxLife: 0.4
      });
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 0.85
    });
  }

  public render(snap: GameSnapshot, dt: number): void {
    this.animTime += dt;

    // Update smooth positions and move trails
    this.updateInterpolatedPositions(snap, dt);

    // Clear background
    this.ctx.fillStyle = '#0B0E13';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 1. Draw Grid & Zones
    this.drawBoard();

    // 2. Draw Movement Trails (show where pieces walked/jumped)
    this.drawMoveTrails(dt);

    // 3. Draw Highlights & King Moves
    this.drawHighlights(snap);

    // 4. Draw Active Targeting Beams & Clash Indicators (Who is attacking whom!)
    this.drawTargetingTethers(snap);

    // 5. Draw Weak Pathfinding Lines (subtle legal next step lines)
    this.drawWeakPathfindingLines(snap);

    // 6. Draw Kings & Pieces with smooth positions
    this.drawPieces(snap);

    this.drawMoveTrailEmblems();

    // 7. Draw Connected Pawns Link-Lines (-20% damage synergy)
    this.drawConnectedPawnLinks(snap);

    // 8. Draw Combat Strikes & Effects (Beams, Slashes, Particles, Floating Text)
    this.drawEffects(dt);

    // 9. Screen Flash
    if (this.screenFlash > 0) {
      this.ctx.fillStyle = `rgba(255, 71, 87, ${this.screenFlash * 0.35})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.screenFlash = Math.max(0, this.screenFlash - dt * 3.0);
    }
  }

  private updateInterpolatedPositions(snap: GameSnapshot, dt: number): void {
    const allPieces = [...snap.pieces, snap.playerKing, snap.enemyKing];

    for (const p of allPieces) {
      const target = this.cellToScreen(p.col, p.row);
      let disp = this.pieceDisplays.get(p.uid);

      if (!disp) {
        disp = {
          currentX: target.x,
          currentY: target.y,
          targetX: target.x,
          targetY: target.y,
          prevX: target.x,
          prevY: target.y,
          isJumping: false,
          jumpProgress: 0,
          hitFlash: 0
        };
        this.pieceDisplays.set(p.uid, disp);
        continue; // DO NOT SPAWN A TRAIL ON FIRST APPEARANCE / SPAWN!
      }

      // Check if piece stepped to a new square
      if (disp.targetX !== target.x || disp.targetY !== target.y) {
        const moveDist = Math.hypot(target.x - disp.currentX, target.y - disp.currentY);
        // Only spawn trail on real active moves, never on spawn or teleport
        if (moveDist > 6 && moveDist < this.cellSize * 10 && disp.prevX > 0) {
          const trailColor = p.owner === 'player' ? '#39D0FF' : '#FF4FD8';
          if (p.pieceType === 'knight') {
            const cornerX = disp.currentX;
            const cornerY = target.y;
            this.moveTrails.push({
              fromX: disp.currentX,
              fromY: disp.currentY,
              toX: target.x,
              toY: target.y,
              isKnightL: true,
              cornerX,
              cornerY,
              color: trailColor,
              pieceType: p.pieceType,
              alpha: 1.0
            });
            disp.isJumping = true;
            disp.jumpProgress = 0;
          } else {
            this.moveTrails.push({
              fromX: disp.currentX,
              fromY: disp.currentY,
              toX: target.x,
              toY: target.y,
              color: trailColor,
              pieceType: p.pieceType,
              alpha: 1.0
            });
          }
        }

        disp.prevX = disp.currentX;
        disp.prevY = disp.currentY;
        disp.targetX = target.x;
        disp.targetY = target.y;
      }

      // Smooth interpolation glide
      const speed = p.pieceType === 'knight' ? 7 : 10;
      disp.currentX += (disp.targetX - disp.currentX) * Math.min(1.0, dt * speed);
      disp.currentY += (disp.targetY - disp.currentY) * Math.min(1.0, dt * speed);

      if (disp.isJumping) {
        disp.jumpProgress = Math.min(1.0, (disp.jumpProgress || 0) + dt * 3.0);
        if (disp.jumpProgress >= 1.0) {
          disp.isJumping = false;
        }
      }

      if (disp.hitFlash && disp.hitFlash > 0) {
        disp.hitFlash = Math.max(0, disp.hitFlash - dt * 4);
      }
    }
  }

  private getPieceRenderPos(p: ActivePiece): { x: number; y: number } {
    const disp = this.pieceDisplays.get(p.uid);
    if (!disp) return this.cellToScreen(p.col, p.row);

    let y = disp.currentY;
    if (disp.isJumping && disp.jumpProgress !== undefined) {
      // Parabolic jump arc
      const arc = Math.sin(disp.jumpProgress * Math.PI) * (this.cellSize * 0.75);
      y -= arc;
    }
    return { x: disp.currentX, y };
  }

  private drawBoard(): void {
    const ctx = this.ctx;

    // Outer border (crisper high-contrast boundary)
    ctx.strokeStyle = '#2B374A';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.boardX, this.boardY, this.boardW, this.boardH);

    for (let screenCol = 0; screenCol < BOARD_COLS; screenCol++) {
      for (let screenRow = 1; screenRow <= BOARD_ROWS; screenRow++) {
        const rowFromTop = BOARD_ROWS - screenRow;
        const x = this.boardX + screenCol * this.cellSize;
        const y = this.boardY + rowFromTop * this.cellSize;

        const logicalCol = this.isFlipped ? (BOARD_COLS - 1 - screenCol) : screenCol;
        const logicalRow = this.isFlipped ? (BOARD_ROWS + 1 - screenRow) : screenRow;

        if (logicalRow >= 9 && logicalRow <= 16) {
          ctx.fillStyle = (logicalCol + logicalRow) % 2 === 0 ? '#18202D' : '#121722'; // Enemy 8x8 board
        } else {
          ctx.fillStyle = (logicalCol + logicalRow) % 2 === 0 ? '#1B2433' : '#131A26'; // Player 8x8 board
        }

        ctx.fillRect(x, y, this.cellSize, this.cellSize);
        ctx.strokeStyle = 'rgba(78, 102, 133, 0.45)'; // Brightened crisp grid lines (Issue #5)
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);
      }
    }

    // Midfield dividing line between Row 8 and Row 9 (Two 8x8 boards meeting at the center)
    const midY = this.boardY + 8 * this.cellSize;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#39D0FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.boardX, midY);
    ctx.lineTo(this.boardX + this.boardW, midY);
    ctx.stroke();
    ctx.restore();

    // Column letters & Row numbers
    ctx.font = 'bold 10px "Chakra Petch", "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < BOARD_COLS; c++) {
      const logicalCol = this.isFlipped ? (BOARD_COLS - 1 - c) : c;
      const letter = String.fromCharCode(65 + logicalCol);
      const x = this.boardX + c * this.cellSize + this.cellSize / 2;
      ctx.fillStyle = '#56667A';
      ctx.fillText(letter, x, this.boardY - 10);
      ctx.fillText(letter, x, this.boardY + this.boardH + 11);
    }

    ctx.textAlign = 'right';
    for (let r = 1; r <= BOARD_ROWS; r++) {
      const y = this.boardY + (BOARD_ROWS - r) * this.cellSize + this.cellSize / 2;
      const logicalRow = this.isFlipped ? (BOARD_ROWS + 1 - r) : r;
      if (logicalRow === 8) {
        ctx.fillStyle = '#39D0FF';
        const arrow = this.isFlipped ? '▼' : '▲';
        ctx.fillText(`${logicalRow}${arrow}`, this.boardX - 3, y);
      } else if (logicalRow === 9) {
        ctx.fillStyle = '#FF4FD8';
        const arrow = this.isFlipped ? '▲' : '▼';
        ctx.fillText(`${logicalRow}${arrow}`, this.boardX - 3, y);
      } else {
        ctx.fillStyle = logicalRow <= 8 ? '#56667A' : '#7A5666';
        ctx.fillText(`${logicalRow}`, this.boardX - 3, y);
      }
    }
  }

  private drawMoveTrails(dt: number): void {
    const ctx = this.ctx;

    for (let i = this.moveTrails.length - 1; i >= 0; i--) {
      const trail = this.moveTrails[i];
      trail.alpha -= dt * 2.0;
      if (trail.alpha <= 0) {
        this.moveTrails.splice(i, 1);
        continue;
      }

      ctx.save();
      // Smooth gradient along movement direction (fades away toward the tail)
      const grad = ctx.createLinearGradient(trail.fromX, trail.fromY, trail.toX, trail.toY);
      const isPlayer = trail.color.includes('39D0FF') || trail.color === '#39D0FF';
      const c = isPlayer ? '57, 208, 255' : '255, 79, 216';

      // Tail (start) = 0 opacity (faded away)
      grad.addColorStop(0, `rgba(${c}, 0)`);
      // Mid = soft
      grad.addColorStop(0.4, `rgba(${c}, ${trail.alpha * 0.25})`);
      // Head (target) = bright leading edge
      grad.addColorStop(1, `rgba(${c}, ${trail.alpha * 0.7})`);

      ctx.strokeStyle = grad;
      const dx = trail.toX - trail.fromX;
      const dy = trail.toY - trail.fromY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normalX = -dy / distance;
      const normalY = dx / distance;

      if (trail.pieceType === 'knight' && trail.cornerX !== undefined && trail.cornerY !== undefined) {
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 2]);
        ctx.beginPath();
        ctx.moveTo(trail.fromX, trail.fromY);
        ctx.lineTo(trail.cornerX, trail.cornerY);
        ctx.lineTo(trail.toX, trail.toY);
        ctx.stroke();
        ctx.fillStyle = trail.color;
        ctx.globalAlpha = trail.alpha * 0.8;
        ctx.fillRect(trail.cornerX - 2, trail.cornerY - 2, 4, 4);
      } else if (trail.pieceType === 'bishop') {
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        for (const offset of [-2.5, 2.5]) {
          ctx.beginPath();
          ctx.moveTo(trail.fromX + normalX * offset, trail.fromY + normalY * offset);
          ctx.lineTo(trail.toX + normalX * offset, trail.toY + normalY * offset);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = trail.pieceType === 'rook' ? 4.5 : trail.pieceType === 'king' ? 3 : 2.5;
        ctx.setLineDash(trail.pieceType === 'pawn' ? [2, 4] : trail.pieceType === 'queen' ? [1, 3] : []);
        ctx.lineCap = trail.pieceType === 'rook' ? 'square' : 'butt';
        ctx.beginPath();
        ctx.moveTo(trail.fromX, trail.fromY);
        ctx.lineTo(trail.toX, trail.toY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawMoveTrailEmblems(): void {
    const ctx = this.ctx;

    for (const trail of this.moveTrails) {
      if (trail.pieceType !== 'rook' && trail.pieceType !== 'queen' && trail.pieceType !== 'king') continue;

      const radius = this.cellSize * (trail.pieceType === 'king' ? 0.34 : 0.31);
      ctx.save();
      ctx.globalAlpha = trail.alpha * 0.72;
      ctx.strokeStyle = trail.pieceType === 'king' ? '#FFE600' : trail.color;
      ctx.lineWidth = 1.75;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 6;

      if (trail.pieceType === 'rook') {
        ctx.strokeRect(trail.toX - radius, trail.toY - radius, radius * 2, radius * 2);
      } else if (trail.pieceType === 'queen') {
        ctx.beginPath();
        for (let point = 0; point < 8; point++) {
          const angle = -Math.PI / 2 + point * Math.PI / 4;
          const pointRadius = point % 2 === 0 ? radius : radius * 0.72;
          const x = trail.toX + Math.cos(angle) * pointRadius;
          const y = trail.toY + Math.sin(angle) * pointRadius;
          point === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let point = 0; point < 6; point++) {
          const angle = -Math.PI / 2 + point * Math.PI / 3;
          const x = trail.toX + Math.cos(angle) * radius;
          const y = trail.toY + Math.sin(angle) * radius;
          point === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private drawHighlights(snap: GameSnapshot): void {
    const ctx = this.ctx;

    // 1. King Selection: show 8 adjacent escape squares!
    if (this.isKingSelected) {
      const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 6);
      const myKing = this.isFlipped ? snap.enemyKing : snap.playerKing;
      const kingPos = this.getPieceRenderPos(myKing);

      // Gold halo around selected King
      ctx.strokeStyle = `rgba(255, 230, 0, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(
        kingPos.x - this.cellSize / 2 + 1,
        kingPos.y - this.cellSize / 2 + 1,
        this.cellSize - 2,
        this.cellSize - 2
      );

      // 8 adjacent legal move dots
      const moves = getLegalKingMoves(myKing.col, myKing.row);
      for (const m of moves) {
        const isOccupied = snap.pieces.some(
          (p) => p.owner === myKing.owner && p.col === m.col && p.row === m.row && p.hp > 0
        );
        if (isOccupied) continue;

        const pos = this.cellToScreen(m.col, m.row);
        ctx.fillStyle = 'rgba(166, 255, 63, 0.45)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#A6FF3F';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 2. Piece Placement Highlights
    if (this.highlightedCells.length > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 5);
      const color = `rgba(57, 208, 255, ${0.18 + pulse * 0.22})`;

      for (const cell of this.highlightedCells) {
        const pos = this.cellToScreen(cell.col, cell.row);
        const x = pos.x - this.cellSize / 2;
        const y = pos.y - this.cellSize / 2;

        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);

        ctx.strokeStyle = '#39D0FF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
      }
    }

    // 3. Hover / Drag Preview Cell Focus Box
    if (this.previewCell) {
      const isLegal = this.highlightedCells.some(
        (c) => c.col === this.previewCell!.col && c.row === this.previewCell!.row
      );
      const pos = this.cellToScreen(this.previewCell.col, this.previewCell.row);
      const x = pos.x - this.cellSize / 2;
      const y = pos.y - this.cellSize / 2;

      if (isLegal) {
        // Radiant golden cell fill on hover!
        ctx.fillStyle = 'rgba(255, 230, 0, 0.25)';
        ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);

        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);

        if (this.selectedPieceId) {
          const def = CHESS_PIECES[this.selectedPieceId];
          if (def) {
            const outlineSprite = sprites.getOutlineSprite(def.pieceType);
            if (outlineSprite && outlineSprite.complete && outlineSprite.naturalWidth > 0) {
              const sSize = Math.floor(this.cellSize * 0.88);
              ctx.save();
              ctx.globalAlpha = 0.88;
              ctx.drawImage(
                outlineSprite,
                Math.floor(x + (this.cellSize - sSize) / 2),
                Math.floor(y + (this.cellSize - sSize) / 2),
                sSize,
                sSize
              );
              ctx.restore();
            }
          }
        }
      } else {
        // Red subtle warning on illegal hover cell
        ctx.fillStyle = 'rgba(255, 71, 87, 0.15)';
        ctx.fillRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
        ctx.strokeStyle = 'rgba(255, 71, 87, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
      }
    }
  }

  // Active Combat Targeting Tethers: Clearly shows who is attacking whom!
  private drawTargetingTethers(snap: GameSnapshot): void {
    // Issue #7: Never draw combat tethers or target reticles once game is over
    if (snap.isGameOver) return;
    const ctx = this.ctx;

    for (const piece of snap.pieces) {
      if (piece.hp <= 0) continue;
      const enemyKing = piece.owner === 'player' ? snap.enemyKing : snap.playerKing;
      // Issue #7: Never target dead King
      if (!enemyKing || enemyKing.hp <= 0) continue;

      const pPos = this.getPieceRenderPos(piece);
      const isPlayer = piece.owner === 'player';
      const tetherColor = isPlayer ? '#39D0FF' : '#FF4FD8';

      // Case 1: Attacking the King directly!
      if (getChebyshevDistance(piece, enemyKing) <= 1) {
        const kPos = this.getPieceRenderPos(enemyKing);

        ctx.save();
        ctx.strokeStyle = tetherColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 3]);
        ctx.lineDashOffset = -this.animTime * 25;

        // Animated strike laser into the King
        ctx.beginPath();
        ctx.moveTo(pPos.x, pPos.y);
        ctx.lineTo(kPos.x, kPos.y);
        ctx.stroke();

        // Pulsing warning crosshairs around King
        const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 8);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#FF4757';
        ctx.lineWidth = 2;
        const r = this.cellSize * (0.45 + pulse * 0.08);

        ctx.beginPath();
        ctx.arc(kPos.x, kPos.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair brackets
        const s = r + 4;
        ctx.beginPath();
        ctx.moveTo(kPos.x - s, kPos.y - 4);
        ctx.lineTo(kPos.x - s, kPos.y + 4);
        ctx.moveTo(kPos.x + s, kPos.y - 4);
        ctx.lineTo(kPos.x + s, kPos.y + 4);
        ctx.stroke();

        ctx.restore();
      } else {
        // Case 2: Adjacent piece combat (fighting an enemy blocker!)
        const hostile = snap.pieces.find(
          (other) =>
            other.owner !== piece.owner &&
            other.hp > 0 &&
            getChebyshevDistance(piece, other) <= 1
        );

        if (hostile && piece.uid < hostile.uid) {
          const hPos = this.getPieceRenderPos(hostile);

          ctx.save();
          ctx.strokeStyle = 'rgba(255, 230, 0, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -this.animTime * 15;

          ctx.beginPath();
          ctx.moveTo(pPos.x, pPos.y);
          ctx.lineTo(hPos.x, hPos.y);
          ctx.stroke();

          ctx.restore();
        }
      }
    }
  }

  // Weak Pathfinding Lines: Faint, subtle lines showing strictly the legal next square/path
  private drawWeakPathfindingLines(snap: GameSnapshot): void {
    if (snap.isGameOver) return;
    const ctx = this.ctx;

    for (const piece of snap.pieces) {
      if (piece.hp <= 0) continue;
      const pPos = this.getPieceRenderPos(piece);
      const isPlayer = piece.owner === 'player';
      const forwardDir = isPlayer ? 1 : -1;
      const pathColor = isPlayer ? 'rgba(57, 208, 255, 0.25)' : 'rgba(255, 79, 216, 0.25)';

      ctx.save();
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);

      if (piece.pieceType === 'pawn') {
        // Faint 1-square vertical step straight forward along file
        const nextY = pPos.y - forwardDir * this.cellSize;
        ctx.beginPath();
        ctx.moveTo(pPos.x, pPos.y);
        ctx.lineTo(pPos.x, nextY);
        ctx.stroke();

        ctx.fillStyle = pathColor;
        ctx.beginPath();
        ctx.arc(pPos.x, nextY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (piece.pieceType === 'knight') {
        const enemyKing = isPlayer ? snap.enemyKing : snap.playerKing;
        const jumps = getKnightLTargets(piece.col, piece.row);
        let bestJump: { col: number; row: number } | null = null;
        let bestDist = 999;
        for (const j of jumps) {
          const occ = snap.pieces.some((o) => o.col === j.col && o.row === j.row && o.hp > 0);
          if (!occ) {
            const d = getChebyshevDistance(j, enemyKing);
            if (d < bestDist) {
              bestDist = d;
              bestJump = j;
            }
          }
        }
        if (bestJump) {
          const targetScreen = this.cellToScreen(bestJump.col, bestJump.row);
          const cornerScreen = this.cellToScreen(piece.col, bestJump.row);
          ctx.beginPath();
          ctx.moveTo(pPos.x, pPos.y);
          ctx.lineTo(cornerScreen.x, cornerScreen.y);
          ctx.lineTo(targetScreen.x, targetScreen.y);
          ctx.stroke();

          ctx.fillStyle = pathColor;
          ctx.beginPath();
          ctx.arc(targetScreen.x, targetScreen.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Rook, Bishop, Queen
        const disp = this.pieceDisplays.get(piece.uid);
        if (disp && (disp.targetX !== disp.currentX || disp.targetY !== disp.currentY)) {
          ctx.beginPath();
          ctx.moveTo(pPos.x, pPos.y);
          ctx.lineTo(disp.targetX, disp.targetY);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  private drawPieces(snap: GameSnapshot): void {
    // Draw Kings
    this.drawKingPiece(snap.playerKing, 'player');
    this.drawKingPiece(snap.enemyKing, 'enemy');

    // Draw pieces
    for (const piece of snap.pieces) {
      if (piece.hp <= 0) continue;
      const pos = this.getPieceRenderPos(piece);
      this.drawChessPiece(piece.uid, piece.pieceType, piece.owner, pos.x, pos.y, piece.hp, piece.maxHp);
    }
  }

  // Connected Pawns: Visual neon link-line between supporting diagonal pawns
  private drawConnectedPawnLinks(snap: GameSnapshot): void {
    const ctx = this.ctx;
    const pawns = snap.pieces.filter((p) => p.pieceType === 'pawn' && p.hp > 0);

    for (let i = 0; i < pawns.length; i++) {
      for (let j = i + 1; j < pawns.length; j++) {
        const p1 = pawns[i];
        const p2 = pawns[j];
        if (p1.owner === p2.owner) {
          // Check if diagonal-adjacent
          if (Math.abs(p1.col - p2.col) === 1 && Math.abs(p1.row - p2.row) === 1) {
            const pos1 = this.getPieceRenderPos(p1);
            const pos2 = this.getPieceRenderPos(p2);
            const color = p1.owner === 'player' ? 'rgba(57, 208, 255, 0.45)' : 'rgba(255, 79, 216, 0.45)';

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.stroke();

            // Diamond shield link icon in the middle
            const midX = (pos1.x + pos2.x) / 2;
            const midY = (pos1.y + pos2.y) / 2;
            ctx.fillStyle = p1.owner === 'player' ? '#39D0FF' : '#FF4FD8';
            ctx.beginPath();
            ctx.arc(midX, midY, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      }
    }
  }

  private drawKingPiece(king: ActivePiece, owner: PlayerId): void {
    if (king.hp <= 0) return;
    const pos = this.getPieceRenderPos(king);
    const ctx = this.ctx;

    // Subtle royal under-glow centered on cell
    const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 4);
    ctx.save();
    ctx.fillStyle = owner === 'player'
      ? `rgba(255, 230, 0, ${0.15 + pulse * 0.12})`
      : `rgba(255, 71, 87, ${0.15 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.cellSize * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // Centered contact drop shadow directly beneath King base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + this.cellSize * 0.22, this.cellSize * 0.3, this.cellSize * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Large King Sprite (96% of cell)
    const spriteKey = owner === 'player' ? 'white_king' : 'black_king';
    const sprite = sprites.get(spriteKey);

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const size = Math.floor(this.cellSize * 0.96);
      if (owner === 'enemy') {
        // Subtle luminous crimson/magenta rim on dark King (Issue #5)
        ctx.save();
        ctx.shadowColor = 'rgba(255, 71, 87, 0.7)';
        ctx.shadowBlur = 8;
        ctx.drawImage(sprite, Math.floor(pos.x - size / 2), Math.floor(pos.y - size / 2), size, size);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, Math.floor(pos.x - size / 2), Math.floor(pos.y - size / 2), size, size);
      }
    } else {
      ctx.fillStyle = owner === 'player' ? '#FFE600' : '#FF4757';
      ctx.font = `bold ${Math.floor(this.cellSize * 0.7)}px "Chakra Petch", "Rajdhani", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♚', pos.x, pos.y);
    }

    // Health Bar
    this.drawHealthBar(pos.x, pos.y - this.cellSize * 0.46, king.hp, king.maxHp, owner, 'king');
  }

  private drawChessPiece(
    uid: string,
    pieceType: UnitType,
    owner: PlayerId,
    cx: number,
    cy: number,
    hp: number,
    maxHp: number
  ): void {
    const ctx = this.ctx;
    const disp = this.pieceDisplays.get(uid);

    // Centered contact shadow directly beneath piece base (never overflows bottom border!)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + this.cellSize * 0.22, this.cellSize * 0.28, this.cellSize * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hit-flash effect (soft glow when struck)
    if (disp && disp.hitFlash && disp.hitFlash > 0.05) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, this.cellSize * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const spriteKey = `${owner === 'player' ? 'white' : 'black'}_${pieceType}`;
    const sprite = sprites.get(spriteKey);

    // Large Piece Sprite (95% of cell)
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const size = Math.floor(this.cellSize * 0.95);
      if (owner === 'enemy') {
        // Subtle luminous flora/magenta rim on dark pieces (Issue #5)
        ctx.save();
        ctx.shadowColor = 'rgba(255, 79, 216, 0.6)';
        ctx.shadowBlur = 6;
        ctx.drawImage(sprite, Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);
      }
    } else {
      let symbol = '♟';
      if (pieceType === 'knight') symbol = '♞';
      else if (pieceType === 'bishop') symbol = '♝';
      else if (pieceType === 'rook') symbol = '♜';
      else if (pieceType === 'queen') symbol = '♛';

      ctx.fillStyle = owner === 'player' ? '#39D0FF' : '#FF4FD8';
      ctx.font = `bold ${Math.floor(this.cellSize * 0.65)}px "Chakra Petch", "Rajdhani", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, cx, cy);
    }

    this.drawHealthBar(cx, cy - this.cellSize * 0.44, hp, maxHp, owner, pieceType);
  }

  private drawHealthBar(
    cx: number,
    cy: number,
    hp: number,
    maxHp: number,
    owner: PlayerId,
    pieceType: UnitType
  ): void {
    const ctx = this.ctx;
    const barW = this.cellSize * 0.7;
    const barH = Math.max(3, this.cellSize * 0.08);
    const x = cx - barW / 2;
    const y = cy;
    const damagePerHit = CHESS_PIECES[`piece.${pieceType}`]?.attackDamage ?? maxHp;
    const rawSectorCount = Math.max(1, Math.ceil(maxHp / damagePerHit));
    const sectorCount = Math.min(8, rawSectorCount);
    const sectorCapacity = rawSectorCount > sectorCount ? maxHp / sectorCount : damagePerHit;
    const gap = Math.min(1, barW / (sectorCount * 4));
    const sectorW = (barW - gap * (sectorCount - 1)) / sectorCount;

    ctx.fillStyle = '#141A24';
    ctx.fillRect(x, y, barW, barH);

    ctx.fillStyle = owner === 'player' ? '#39D0FF' : '#FF4757';
    for (let sector = 0; sector < sectorCount; sector++) {
      const sectorHp = Math.max(0, Math.min(sectorCapacity, hp - sector * sectorCapacity));
      if (sectorHp <= 0) continue;
      const fill = sectorHp / Math.min(sectorCapacity, maxHp - sector * sectorCapacity);
      ctx.fillRect(x + sector * (sectorW + gap), y, sectorW * fill, barH);
    }
  }

  private drawPieceBurst(burst: PieceBurst): void {
    const ctx = this.ctx;
    const t = burst.progress;
    const alpha = burst.kind === 'death' ? 1 - t : Math.sin(t * Math.PI);
    const scale = burst.kind === 'death'
      ? 1 + t * 0.75
      : 0.25 + (1 - Math.pow(1 - t, 3)) * 0.85;
    const radius = this.cellSize * 0.38 * scale;

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = burst.color;
    ctx.fillStyle = burst.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'bevel';
    ctx.shadowColor = burst.color;
    ctx.shadowBlur = 8;
    ctx.setLineDash(burst.kind === 'death' ? [3, 3] : []);

    if (burst.pieceType === 'pawn') {
      ctx.translate(0, -this.cellSize * 0.18);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, radius * 0.72);
      ctx.lineTo(0, -radius * 0.82);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.24);
      ctx.quadraticCurveTo(-radius * 0.78, -radius * 0.3, -radius * 0.72, -radius * 0.82);
      ctx.quadraticCurveTo(-radius * 0.16, -radius * 0.72, 0, -radius * 0.24);
      ctx.moveTo(0, -radius * 0.02);
      ctx.quadraticCurveTo(radius * 0.78, -radius * 0.08, radius * 0.72, -radius * 0.6);
      ctx.quadraticCurveTo(radius * 0.16, -radius * 0.5, 0, -radius * 0.02);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, radius * 0.58, Math.max(2.5, radius * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-radius * 0.86, radius * 0.08, 2, 0, Math.PI * 2);
      ctx.arc(radius * 0.9, -radius * 0.18, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (burst.pieceType === 'knight') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.72, radius * 0.62);
      ctx.lineTo(-radius * 0.72, -radius * 0.58);
      ctx.lineTo(radius * 0.15, -radius * 0.58);
      ctx.lineTo(radius * 0.15, radius * 0.1);
      ctx.lineTo(radius * 0.72, radius * 0.1);
      ctx.stroke();
      ctx.fillRect(-radius * 0.82, -radius * 0.68, Math.max(3, radius * 0.2), Math.max(3, radius * 0.2));
    } else if (burst.pieceType === 'bishop') {
      ctx.lineWidth = 1.5;
      for (const offset of [-radius * 0.16, radius * 0.16]) {
        ctx.beginPath();
        ctx.moveTo(-radius + offset, radius);
        ctx.lineTo(radius + offset, -radius);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.72);
      ctx.lineTo(radius * 0.46, 0);
      ctx.lineTo(0, radius * 0.72);
      ctx.lineTo(-radius * 0.46, 0);
      ctx.closePath();
      ctx.stroke();
    } else if (burst.pieceType === 'rook') {
      ctx.lineWidth = 3;
      ctx.strokeRect(-radius * 0.72, -radius * 0.72, radius * 1.44, radius * 1.44);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
      for (const x of [-radius * 0.55, 0, radius * 0.55]) {
        ctx.fillRect(x - radius * 0.12, -radius, radius * 0.24, radius * 0.28);
      }
    } else if (burst.pieceType === 'queen') {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      for (let petal = 0; petal < 8; petal++) {
        const angle = petal * Math.PI / 4 + t * 0.9;
        const innerX = Math.cos(angle) * radius * 0.32;
        const innerY = Math.sin(angle) * radius * 0.32;
        const outerX = Math.cos(angle) * radius;
        const outerY = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.moveTo(innerX, innerY);
        ctx.quadraticCurveTo(
          Math.cos(angle + 0.32) * radius * 0.78,
          Math.sin(angle + 0.32) * radius * 0.78,
          outerX,
          outerY
        );
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let point = 0; point < 6; point++) {
        const angle = -Math.PI / 2 + point * Math.PI / 3;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        point === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-radius * 0.62, radius * 0.18);
      ctx.lineTo(-radius * 0.48, -radius * 0.5);
      ctx.lineTo(0, -radius * 0.08);
      ctx.lineTo(radius * 0.48, -radius * 0.5);
      ctx.lineTo(radius * 0.62, radius * 0.18);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawEffects(dt: number): void {
    const ctx = this.ctx;

    // Combat Strikes (Slashes, Beams, Impacts)
    for (let i = this.combatStrikes.length - 1; i >= 0; i--) {
      const s = this.combatStrikes[i];
      s.progress += dt / s.duration;
      if (s.progress >= 1.0) {
        this.combatStrikes.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = 1.0 - s.progress;
      const travel = Math.min(1, s.progress * 2.2);
      const dx = s.toX - s.fromX;
      const dy = s.toY - s.fromY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const normalX = -dy / distance;
      const normalY = dx / distance;
      const headX = s.fromX + dx * travel;
      const headY = s.fromY + dy * travel;
      ctx.globalAlpha = alpha;

      if (s.pieceType === 'queen') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 12;
        for (const bend of [-7, 0, 7]) {
          ctx.beginPath();
          ctx.moveTo(s.fromX, s.fromY);
          ctx.quadraticCurveTo(
            (s.fromX + headX) / 2 + normalX * bend,
            (s.fromY + headY) / 2 + normalY * bend,
            headX,
            headY
          );
          ctx.stroke();
        }
        const bloomRadius = this.cellSize * (0.14 + s.progress * 0.24);
        for (let petal = 0; petal < 8; petal++) {
          const angle = petal * Math.PI / 4 + s.progress * 0.8;
          ctx.beginPath();
          ctx.moveTo(s.toX + Math.cos(angle) * bloomRadius * 0.45, s.toY + Math.sin(angle) * bloomRadius * 0.45);
          ctx.lineTo(s.toX + Math.cos(angle) * bloomRadius, s.toY + Math.sin(angle) * bloomRadius);
          ctx.stroke();
        }
      } else if (s.pieceType === 'rook') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'square';
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(s.fromX, s.fromY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        const bastionSize = this.cellSize * (0.18 + s.progress * 0.2);
        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 3;
        ctx.strokeRect(s.toX - bastionSize, s.toY - bastionSize, bastionSize * 2, bastionSize * 2);
      } else if (s.pieceType === 'bishop') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        for (const offset of [-3, 3]) {
          ctx.beginPath();
          ctx.moveTo(s.fromX + normalX * offset, s.fromY + normalY * offset);
          ctx.lineTo(headX + normalX * offset, headY + normalY * offset);
          ctx.stroke();
        }
        const prism = this.cellSize * (0.12 + s.progress * 0.12);
        ctx.beginPath();
        ctx.moveTo(s.toX, s.toY - prism);
        ctx.lineTo(s.toX + prism, s.toY);
        ctx.lineTo(s.toX, s.toY + prism);
        ctx.lineTo(s.toX - prism, s.toY);
        ctx.closePath();
        ctx.stroke();
      } else if (s.pieceType === 'knight') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'bevel';
        const elbowX = s.fromX;
        const elbowY = s.toY;
        const firstLegRatio = Math.abs(dy) / (Math.abs(dx) + Math.abs(dy));
        ctx.beginPath();
        ctx.moveTo(s.fromX, s.fromY);
        if (travel <= firstLegRatio) {
          const legProgress = firstLegRatio === 0 ? 1 : travel / firstLegRatio;
          ctx.lineTo(elbowX, s.fromY + dy * legProgress);
        } else {
          const legProgress = (travel - firstLegRatio) / Math.max(0.001, 1 - firstLegRatio);
          ctx.lineTo(elbowX, elbowY);
          ctx.lineTo(elbowX + dx * legProgress, elbowY);
        }
        ctx.stroke();
        ctx.fillStyle = '#A6FF3F';
        ctx.fillRect(elbowX - 2.5, elbowY - 2.5, 5, 5);
      } else if (s.pieceType === 'king') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.moveTo(s.fromX, s.fromY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        const ward = this.cellSize * (0.16 + s.progress * 0.18);
        ctx.strokeStyle = '#FFE600';
        ctx.beginPath();
        for (let point = 0; point < 6; point++) {
          const angle = -Math.PI / 2 + point * Math.PI / 3;
          const x = s.toX + Math.cos(angle) * ward;
          const y = s.toY + Math.sin(angle) * ward;
          point === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(s.fromX, s.fromY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        const arrow = this.cellSize * 0.16;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX - dx / distance * arrow + normalX * arrow * 0.55, headY - dy / distance * arrow + normalY * arrow * 0.55);
        ctx.lineTo(headX - dx / distance * arrow - normalX * arrow * 0.55, headY - dy / distance * arrow - normalY * arrow * 0.55);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    for (let i = this.pieceBursts.length - 1; i >= 0; i--) {
      const burst = this.pieceBursts[i];
      burst.progress += dt / burst.duration;
      if (burst.progress >= 1) {
        this.pieceBursts.splice(i, 1);
        continue;
      }
      this.drawPieceBurst(burst);
    }

    // 2. Coronation Animations (Pawn -> Queen Ascension)
    for (let i = this.coronations.length - 1; i >= 0; i--) {
      const c = this.coronations[i];
      c.progress += dt / c.duration;
      if (c.progress >= 1.0) {
        this.coronations.splice(i, 1);
        continue;
      }

      ctx.save();
      const alpha = Math.sin(c.progress * Math.PI);

      // Light Pillar
      const beamW = this.cellSize * 0.9;
      const beamGrad = ctx.createLinearGradient(0, this.boardY, 0, this.boardY + this.boardH);
      beamGrad.addColorStop(0, `rgba(255, 230, 0, ${alpha * 0.45})`);
      beamGrad.addColorStop(1, 'rgba(255, 230, 0, 0)');
      ctx.fillStyle = beamGrad;
      ctx.fillRect(c.x - beamW / 2, this.boardY, beamW, this.boardH);

      // Expanding Shockwaves
      const maxR = this.cellSize * 2.2;
      const r1 = maxR * Math.min(1.0, c.progress * 1.4);
      const r2 = maxR * Math.max(0, (c.progress - 0.25) * 1.4);

      ctx.strokeStyle = c.color;
      ctx.lineWidth = 3 * (1.0 - c.progress);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r1, 0, Math.PI * 2);
      ctx.stroke();

      if (r2 > 0) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Descending Royal Crown
      const crownY = c.y - this.cellSize * 0.65 - (1.0 - Math.min(1.0, c.progress * 2.2)) * 36;
      ctx.font = `bold ${Math.floor(this.cellSize * 0.55)}px "Chakra Petch", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFE600';
      ctx.shadowColor = '#FFE600';
      ctx.shadowBlur = 14;
      ctx.fillText('👑', c.x, crownY);

      ctx.restore();
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = 1.0 - p.life / p.maxLife;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }

    // Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y -= dt * 25;
      ft.alpha = 1.0 - ft.life / ft.maxLife;

      ctx.save();
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 12px "Chakra Petch", "Rajdhani", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
