import { GameSim } from './sim/sim';
import { CHESS_PIECES, DECK_PIECES } from './sim/units';
import { GameRenderer } from './ui/renderer';
import { BotAI, AIDifficulty } from './sim/ai';
import { sound } from './audio/synth';
import { getLegalDeploymentCells, getLegalKingMoves } from './sim/board';
import { PlayerId } from './sim/types';
import { sprites } from './ui/sprites';
import { net } from './net/p2p';
import { jazz } from './audio/jazz';

// App state
let sim = new GameSim(Date.now() % 100000);
let currentDifficulty: AIDifficulty = 'apprentice'; // Issue #1: Default to Apprentice for new players
let bot = new BotAI('enemy', currentDifficulty);
let renderer: GameRenderer;

type GameMode = 'bot' | 'p2p-host' | 'p2p-guest' | 'hotseat';
let currentMode: GameMode = 'bot';

let speedMultiplier = 1;
let selectedCardId: string | null = null;
let activePlayerId: PlayerId = 'player';
let aiToastTimeout: ReturnType<typeof setTimeout> | null = null;
let syncBroadcastTimer = 0;
const MAX_CATCH_UP_TICKS = 20;

// DOM elements
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const cardsGrid = document.getElementById('cards-grid') as HTMLDivElement;
const essenceNum = document.getElementById('essence-num') as HTMLSpanElement;
const essenceBar = document.getElementById('essence-bar') as HTMLDivElement;

const enemyCoreNum = document.getElementById('enemy-core-num') as HTMLSpanElement;
const enemyCoreBar = document.getElementById('enemy-core-bar') as HTMLDivElement;
const playerCoreNum = document.getElementById('player-core-num') as HTMLSpanElement;
const playerCoreBar = document.getElementById('player-core-bar') as HTMLDivElement;

const matchClock = document.getElementById('match-clock') as HTMLDivElement;
const overtimeBadge = document.getElementById('overtime-badge') as HTMLDivElement;

// Top Info Strip & Guidance elements
const topInfoMessage = document.getElementById('top-info-message') as HTMLDivElement;
const btnCancelHint = document.getElementById('btn-cancel-hint') as HTMLButtonElement;

// P2P Multiplayer Modal
const p2pModal = document.getElementById('p2p-modal') as HTMLDivElement;
const btnQuickMatch = document.getElementById('btn-quick-match') as HTMLButtonElement;
const lobbyStatusText = document.getElementById('lobby-status-text') as HTMLDivElement;
const lobbyStatusMsg = document.getElementById('lobby-status-msg') as HTMLSpanElement;
const inviteUrlInput = document.getElementById('invite-url-input') as HTMLInputElement;
const btnCopyInvite = document.getElementById('btn-copy-invite') as HTMLButtonElement;
const btnNativeShare = document.getElementById('btn-native-share') as HTMLButtonElement;
const inviteStatusText = document.getElementById('invite-status-text') as HTMLSpanElement;
const joinCodeInput = document.getElementById('join-code-input') as HTMLInputElement;
const btnJoinCode = document.getElementById('btn-join-code') as HTMLButtonElement;
const btnLocalPass = document.getElementById('btn-local-pass') as HTMLButtonElement;
const btnCloseP2p = document.getElementById('btn-close-p2p') as HTMLButtonElement;

// Game over modal
const gameOverModal = document.getElementById('game-over-modal') as HTMLDivElement;
const modalVerdict = document.getElementById('modal-verdict') as HTMLDivElement;
const modalReason = document.getElementById('modal-reason') as HTMLDivElement;
const statPHp = document.getElementById('stat-p-hp') as HTMLTableCellElement;
const statEHp = document.getElementById('stat-e-hp') as HTMLTableCellElement;
const statDuration = document.getElementById('stat-duration') as HTMLTableCellElement;
const btnRematch = document.getElementById('btn-rematch') as HTMLButtonElement;

// Header buttons
const btnDiff = document.getElementById('btn-diff') as HTMLButtonElement;
const diffLabel = document.getElementById('diff-label') as HTMLSpanElement;
const btnModeBot = document.getElementById('btn-mode-bot') as HTMLButtonElement;
const btnModeHotseat = document.getElementById('btn-mode-hotseat') as HTMLButtonElement;
const btnSound = document.getElementById('btn-sound') as HTMLButtonElement;
const soundIcon = document.getElementById('sound-icon') as HTMLElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;

// Header & Presence elements
const onlineCountNum = document.getElementById('online-count-num') as HTMLSpanElement;

// Persistent device client ID (prevents refresh counter inflation)
function getPersistentClientId(): string {
  try {
    const key = 'gb_device_client_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'dev_anon_' + Math.random().toString(36).substring(2, 7);
  }
}
const myClientId = getPersistentClientId();

// Music Widget elements
const btnMusicToggle = document.getElementById('btn-music-toggle') as HTMLButtonElement;
const btnMusicNext = document.getElementById('btn-music-next') as HTMLButtonElement;
const btnMusicShuffle = document.getElementById('btn-music-shuffle') as HTMLButtonElement;
const musicTrackTitle = document.getElementById('music-track-title') as HTMLSpanElement;
const musicNote = document.getElementById('music-note') as HTMLSpanElement;

function triggerHaptic(duration = 15): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {}
  }
}

function updateOnlinePresence(): void {
  fetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: myClientId })
  })
    .then((r) => r.json())
    .then((d: { onlineCount?: number }) => {
      if (onlineCountNum && d.onlineCount !== undefined) {
        onlineCountNum.textContent = `${d.onlineCount}`;
      }
    })
    .catch(() => {
      if (onlineCountNum) onlineCountNum.textContent = '1';
    });
}

async function init(): Promise<void> {
  renderer = new GameRenderer(canvas);
  window.addEventListener('resize', () => renderer.resize());

  // Preload real pixel chess sprites
  await sprites.loadAll();
  renderer.resize();

  setupDeckUI();
  setupInputHandlers();
  setupButtons();
  setupNetworkHandlers();

  // Presence tracking
  updateOnlinePresence();
  setInterval(updateOnlinePresence, 12000);

  // Pick random jazz song for initial game!
  const randomSong = jazz.pickRandomTrack();
  musicTrackTitle.textContent = randomSong.toUpperCase();

  // Check if URL has ?room= parameter
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    joinOnlineRoom(roomParam);
  }

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function setupNetworkHandlers(): void {
  net.onConnected = () => {
    p2pModal.style.display = 'none';
    lobbyStatusText.style.display = 'none';
    btnModeHotseat.classList.add('active');
    btnModeBot.classList.remove('active');
    btnDiff.style.display = 'none';

    const enemyLabel = document.querySelector('.core-enemy-text');
    if (enemyLabel) enemyLabel.innerHTML = '♚ OPPONENT KING';

    if (net.role === 'host') {
      currentMode = 'p2p-host';
      activePlayerId = 'player';
      renderer.isFlipped = false;
      showAiToast('FRIEND JOINED! BATTLE START!');
      net.sendSync(sim.getSnapshot(), []);
    } else {
      currentMode = 'p2p-guest';
      activePlayerId = 'enemy';
      renderer.isFlipped = true;
      showAiToast('CONNECTED TO OPPONENT! BATTLE START!');
    }
    setupDeckUI();
    updateHUD();
    triggerHaptic(30);
  };

  net.onRemoteIntent = (intent) => {
    if (net.role === 'host') {
      const remoteIntent = { ...intent, playerId: 'enemy' as const };
      const success = sim.deployPiece(remoteIntent.playerId, remoteIntent.cardId, remoteIntent.col, remoteIntent.row);
      if (success) {
        sound.playDeploy();
        const def = CHESS_PIECES[remoteIntent.cardId];
        if (def) {
          showAiToast(`FRIEND DEPLOYED ${def.name.toUpperCase()}`);
        }
        net.sendSync(sim.getSnapshot(), sim.events);
      }
    }
  };

  net.onRemoteKingMove = (move) => {
    if (net.role === 'host') {
      const success = sim.moveKing('enemy', move.targetCol, move.targetRow);
      if (success) {
        sound.playDeploy();
        net.sendSync(sim.getSnapshot(), sim.events);
      }
    }
  };

  net.onSyncSnapshot = (snap) => {
    if (net.role === 'guest') {
      sim.applySnapshot(snap);
      updateHUD();
      if (snap.isGameOver && !gameOverModal.style.display.includes('flex')) {
        showGameOverModal(snap.winner ?? 'draw', 'King has fallen');
      }
    }
  };

  net.onRemoteEvents = (events) => {
    renderer.pushEvents(events, sim.getSnapshot());
  };

  net.onDisconnected = () => {
    const disconnectedMode = currentMode;
    if (disconnectedMode !== 'p2p-host' && disconnectedMode !== 'p2p-guest') return;

    currentMode = 'bot';
    activePlayerId = 'player';
    renderer.isFlipped = false;
    btnModeBot.classList.add('active');
    btnModeHotseat.classList.remove('active');
    btnDiff.style.display = 'flex';
    const enemyLabel = document.querySelector('.core-enemy-text');
    if (enemyLabel) enemyLabel.innerHTML = '♚ BOT KING';
    if (disconnectedMode === 'p2p-guest') restartMatch();
    else setupDeckUI();
    updateHUD();
    showAiToast(disconnectedMode === 'p2p-guest'
      ? 'FRIEND DISCONNECTED. STARTING BOT MATCH!'
      : 'FRIEND DISCONNECTED');
  };

  net.onRematchRequested = () => {
    restartMatch();
    showAiToast('REMATCH STARTED!');
  };
}

function setupDeckUI(): void {
  cardsGrid.innerHTML = '';

  DECK_PIECES.forEach((cardId) => {
    const def = CHESS_PIECES[cardId];
    if (!def) return;

    const cardEl = document.createElement('div');
    cardEl.className = 'card-item';
    cardEl.dataset.cardId = cardId;

    const miniUrl = sprites.getMiniSpriteUrl(def.pieceType, activePlayerId === 'enemy' ? 'rot' : 'flora');
    let spriteHtml = '';
    if (miniUrl) {
      spriteHtml = `<img class="card-sprite" src="${miniUrl}" alt="${def.name}" />`;
    } else {
      let symbol = '♟';
      if (def.pieceType === 'knight') symbol = '♞';
      else if (def.pieceType === 'bishop') symbol = '♝';
      else if (def.pieceType === 'rook') symbol = '♜';
      else if (def.pieceType === 'queen') symbol = '♛';
      spriteHtml = `<div class="card-symbol ${activePlayerId === 'enemy' ? 'card-rot' : 'card-flora'}">${symbol}</div>`;
    }

    cardEl.innerHTML = `
      <div class="card-cost">${def.cost}</div>
      ${spriteHtml}
      <div class="card-name">${def.name}</div>
      <div class="cooldown-overlay" style="display: none;">0.0</div>
    `;

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let dragGhost: HTMLDivElement | null = null;

    cardEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!jazz.isPlaying && !jazz.isMuted) jazz.play();

      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;

      const pState = activePlayerId === 'player' ? sim.player : sim.enemy;
      if (pState.essence < def.cost || (pState.cooldowns[cardId] ?? 0) > 0) return;

      const onPointerMove = (me: PointerEvent) => {
        const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
        if (dist > 8 && !isDragging) {
          isDragging = true;
          selectCard(cardId);
          triggerHaptic(15);

          dragGhost = document.createElement('div');
          dragGhost.className = 'drag-ghost';
          dragGhost.innerHTML = spriteHtml;
          dragGhost.style.left = `${me.clientX}px`;
          dragGhost.style.top = `${me.clientY}px`;
          document.body.appendChild(dragGhost);
        }

        if (isDragging && dragGhost) {
          dragGhost.style.left = `${me.clientX}px`;
          dragGhost.style.top = `${me.clientY}px`;

          const pos = renderer.getPointerPos(me);
          const cell = renderer.screenToCell(pos.x, pos.y);
          renderer.previewCell = cell;
        }
      };

      const onPointerUp = (ue: PointerEvent) => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (dragGhost) {
          dragGhost.remove();
          dragGhost = null;
        }

        if (isDragging) {
          isDragging = false;
          renderer.previewCell = null;

          const pos = renderer.getPointerPos(ue);
          const cell = renderer.screenToCell(pos.x, pos.y);

          if (cell) {
            const isLegal = renderer.highlightedCells.some(
              (c) => c.col === cell.col && c.row === cell.row
            );
            if (isLegal) {
              if (currentMode === 'p2p-guest') {
                net.sendIntent({
                  playerId: 'enemy',
                  cardId,
                  col: cell.col,
                  row: cell.row,
                  tick: sim.tick
                });
                triggerHaptic(25);
                sound.playDeploy();
                deselectCard();
              } else {
                const ok = sim.deployPiece(activePlayerId, cardId, cell.col, cell.row);
                if (ok) {
                  triggerHaptic(25);
                  sound.playDeploy();
                  deselectCard();
                  if (currentMode === 'p2p-host') {
                    net.sendSync(sim.getSnapshot(), sim.events);
                  }
                  passHotseatTurn();
                }
              }
            } else {
              deselectCard();
            }
          } else {
            deselectCard();
          }
        } else {
          // Normal tap selection
          triggerHaptic(12);
          if (selectedCardId === cardId) {
            deselectCard();
          } else {
            selectCard(cardId);
          }
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });

    cardsGrid.appendChild(cardEl);
  });
}

let alertMessageTimeout: ReturnType<typeof setTimeout> | null = null;
let activeAlertText: string | null = null;

function updateTopInfoStrip(): void {
  if (!topInfoMessage) return;

  // 1. If an alert is active (e.g. BOT DEPLOYED), show ONLY the alert!
  if (activeAlertText) {
    const announcement = document.createElement('span');
    const icon = document.createElement('i');
    announcement.className = 'top-announcement';
    icon.className = 'hn hn-robot';
    announcement.append(icon, document.createTextNode(` ${activeAlertText}`));
    topInfoMessage.replaceChildren(announcement);
    if (btnCancelHint) btnCancelHint.style.display = 'none';
    return;
  }

  // 2. If a card is selected, show guidance + cancel button!
  if (selectedCardId) {
    const def = CHESS_PIECES[selectedCardId];
    const zoneText = activePlayerId === 'player' ? 'YOUR 8x8 BOARD (ROWS 1-8)' : 'ENEMY 8x8 BOARD (ROWS 9-16)';
    topInfoMessage.innerHTML = `<span class="top-guidance-text">TAP ${zoneText} TO DEPLOY ${def?.name.toUpperCase()}</span>`;
    if (btnCancelHint) btnCancelHint.style.display = 'inline-block';
    return;
  }

  // 3. If King is selected, show king move guidance!
  if (renderer.isKingSelected) {
    topInfoMessage.innerHTML = `<span class="top-guidance-text" style="color: var(--pal-gold);">👑 KING SELECTED: TAP ADJACENT CELL TO RUN!</span>`;
    if (btnCancelHint) btnCancelHint.style.display = 'inline-block';
    return;
  }

  // 4. Otherwise show default ambient hint!
  topInfoMessage.innerHTML = `<span class="default-info-hint">⚔️ HUNT ENEMY KING · PROTECT YOUR KING</span>`;
  if (btnCancelHint) btnCancelHint.style.display = 'none';
}

function selectCard(cardId: string): void {
  const def = CHESS_PIECES[cardId];
  if (!def) return;

  // Deselect king if selected
  renderer.isKingSelected = false;

  selectedCardId = cardId;
  renderer.selectedPieceId = cardId;
  renderer.highlightedCells = getLegalDeploymentCells(activePlayerId);

  document.querySelectorAll('.card-item').forEach((el) => {
    if ((el as HTMLElement).dataset.cardId === cardId) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  updateTopInfoStrip();
  sound.playDeploy();
}

function deselectCard(): void {
  selectedCardId = null;
  renderer.selectedPieceId = null;
  renderer.previewCell = null;
  renderer.highlightedCells = [];
  updateTopInfoStrip();
  document.querySelectorAll('.card-item').forEach((el) => el.classList.remove('selected'));
}

function selectKing(): void {
  deselectCard();
  renderer.isKingSelected = true;
  updateTopInfoStrip();
  sound.playDeploy();
  triggerHaptic(20);
}

function deselectKing(): void {
  renderer.isKingSelected = false;
  updateTopInfoStrip();
}

function passHotseatTurn(): void {
  if (currentMode !== 'hotseat') return;

  activePlayerId = activePlayerId === 'player' ? 'enemy' : 'player';
  renderer.isFlipped = activePlayerId === 'enemy';
  setupDeckUI();
  updateHUD();
  showAiToast(activePlayerId === 'player' ? 'PASS TO FLORA PLAYER' : 'PASS TO ROT PLAYER');
}

function showAiToast(text: string): void {
  activeAlertText = text;
  updateTopInfoStrip();

  if (alertMessageTimeout) clearTimeout(alertMessageTimeout);
  alertMessageTimeout = setTimeout(() => {
    activeAlertText = null;
    updateTopInfoStrip();
  }, 1500);
}

function setupInputHandlers(): void {
  btnCancelHint.addEventListener('click', (e) => {
    e.stopPropagation();
    deselectCard();
    deselectKing();
  });

  // Mouse move / pointer move for cell hover highlighting
  canvas.addEventListener('pointermove', (e) => {
    const pos = renderer.getPointerPos(e);
    const cell = renderer.screenToCell(pos.x, pos.y);
    if ((selectedCardId || renderer.isKingSelected) && cell) {
      renderer.previewCell = cell;
    } else {
      renderer.previewCell = null;
    }
  });

  canvas.addEventListener('pointerleave', () => {
    renderer.previewCell = null;
  });

  // Canvas tap / click
  canvas.addEventListener('pointerdown', (e) => {
    if (!jazz.isPlaying && !jazz.isMuted) jazz.play();
    const pos = renderer.getPointerPos(e);
    const cell = renderer.screenToCell(pos.x, pos.y);
    if (!cell) {
      deselectCard();
      deselectKing();
      return;
    }

    const myKing = activePlayerId === 'player' ? sim.playerKing : sim.enemyKing;

    // Check if player tapped their own King: Select King to move!
    if (cell.col === myKing.col && cell.row === myKing.row) {
      if (renderer.isKingSelected) {
        deselectKing();
      } else {
        selectKing();
      }
      return;
    }

    // If King is selected, move King to adjacent square!
    if (renderer.isKingSelected) {
      const legalMoves = getLegalKingMoves(myKing.col, myKing.row);
      const isLegal = legalMoves.some((m) => m.col === cell.col && m.row === cell.row);

      if (isLegal) {
        if (currentMode === 'p2p-guest') {
          net.sendKingMove(cell.col, cell.row);
          triggerHaptic(25);
          sound.playDeploy();
          deselectKing();
          const targetCoord = String.fromCharCode(65 + cell.col) + cell.row;
          showAiToast(`👑 KING EVADED TO ${targetCoord}!`);
        } else {
          const ok = sim.moveKing(activePlayerId, cell.col, cell.row);
          if (ok) {
            triggerHaptic(25);
            sound.playDeploy();
            deselectKing();
            const targetCoord = String.fromCharCode(65 + cell.col) + cell.row;
            showAiToast(`👑 KING EVADED TO ${targetCoord}!`);
            if (currentMode === 'p2p-host') {
              net.sendSync(sim.getSnapshot(), sim.events);
            }
            passHotseatTurn();
          }
        }
      } else {
        showAiToast('KING CAN ONLY RUN 1 SQUARE AWAY!');
        triggerHaptic(10);
      }
      return;
    }

    // If a piece card is selected, deploy piece!
    if (selectedCardId) {
      const isLegal = renderer.highlightedCells.some(
        (c) => c.col === cell.col && c.row === cell.row
      );

      if (isLegal) {
        if (currentMode === 'p2p-guest') {
          net.sendIntent({
            playerId: 'enemy',
            cardId: selectedCardId,
            col: cell.col,
            row: cell.row,
            tick: sim.tick
          });
          triggerHaptic(20);
          sound.playDeploy();
          deselectCard();
        } else {
          const ok = sim.deployPiece(activePlayerId, selectedCardId, cell.col, cell.row);
          if (ok) {
            triggerHaptic(20);
            sound.playDeploy();
            deselectCard();
            if (currentMode === 'p2p-host') {
              net.sendSync(sim.getSnapshot(), sim.events);
            }
            passHotseatTurn();
          }
        }
      } else {
        triggerHaptic(8);
        showAiToast('TAP YOUR FIELD AT BOTTOM TO DEPLOY!');
      }
    }
  });

  // Tap outside canvas deselects
  document.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest('#cards-grid') &&
      !target.closest('#game-canvas') &&
      !target.closest('#selection-hint') &&
      !target.closest('.modal-card')
    ) {
      deselectCard();
      deselectKing();
    }
  });
}

function openP2PModal(): void {
  p2pModal.style.display = 'flex';
  lobbyStatusText.style.display = 'none';
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const origin = window.location.origin.includes('localhost')
    ? 'https://gravebloom.pages.dev'
    : window.location.origin;
  const uniqueUrl = `${origin}/?room=${code}`;
  inviteUrlInput.value = uniqueUrl;
  inviteStatusText.textContent = `Room ${code} ready. Send link to your friend!`;

  currentMode = 'p2p-host';
  activePlayerId = 'player';
  renderer.isFlipped = false;
  btnModeHotseat.classList.add('active');
  btnModeBot.classList.remove('active');
  btnDiff.style.display = 'none';
  const enemyLabel = document.querySelector('.core-enemy-text');
  if (enemyLabel) enemyLabel.innerHTML = '♚ OPPONENT KING';

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    btnNativeShare.style.display = 'flex';
    btnNativeShare.onclick = () => {
      navigator.share({
        title: 'Play GRAVEBLOOM 1v1 with me!',
        text: 'Join my live real-time chess battle:',
        url: uniqueUrl
      }).catch(() => {});
    };
  }

  net.hostGame(code).then(() => {
    inviteStatusText.textContent = `Room ${code} online. Waiting for friend to open link...`;
  }).catch((err) => {
    console.warn('Peer host error:', err);
  });
}

function joinOnlineRoom(code: string): void {
  p2pModal.style.display = 'none';
  showAiToast(`CONNECTING TO ROOM ${code}...`);
  btnModeHotseat.classList.add('active');
  btnModeBot.classList.remove('active');
  btnDiff.style.display = 'none';

  net.joinGame(code).then(() => {
    const enemyLabel = document.querySelector('.core-enemy-text');
    if (enemyLabel) enemyLabel.innerHTML = '♚ OPPONENT KING';

    if (net.role === 'host') {
      currentMode = 'p2p-host';
      activePlayerId = 'player';
      renderer.isFlipped = false;
      showAiToast(`ROOM ${code} HOSTED! WAITING FOR FRIEND...`);
    } else {
      currentMode = 'p2p-guest';
      activePlayerId = 'enemy';
      renderer.isFlipped = true;
      showAiToast(`JOINED ROOM ${code}!`);
    }
    setupDeckUI();
    updateHUD();
  }).catch((err) => {
    showAiToast('COULD NOT CONNECT TO ROOM');
    console.error(err);
  });
}

function setupButtons(): void {
  // Difficulty toggle
  btnDiff.addEventListener('click', () => {
    if (currentDifficulty === 'tactical') currentDifficulty = 'nightmare';
    else if (currentDifficulty === 'nightmare') currentDifficulty = 'apprentice';
    else currentDifficulty = 'tactical';

    bot.setDifficulty(currentDifficulty);
    diffLabel.textContent = currentDifficulty.toUpperCase();
    showAiToast(`AI DIFFICULTY: ${currentDifficulty.toUpperCase()}`);
    triggerHaptic(15);
  });

  // VS BOT
  btnModeBot.addEventListener('click', () => {
    currentMode = 'bot';
    activePlayerId = 'player';
    renderer.isFlipped = false;
    btnModeBot.classList.add('active');
    btnModeHotseat.classList.remove('active');
    btnDiff.style.display = 'flex';
    const enemyLabel = document.querySelector('.core-enemy-text');
    if (enemyLabel) enemyLabel.innerHTML = '♚ BOT KING';
    net.disconnect();
    restartMatch();
  });

  // 1v1 Invite & Lobby Modal
  btnModeHotseat.addEventListener('click', () => {
    openP2PModal();
  });

  let quickMatchTimer: ReturnType<typeof setInterval> | null = null;

  btnQuickMatch.addEventListener('click', async () => {
    lobbyStatusText.style.display = 'flex';
    let secondsLeft = 8;
    lobbyStatusMsg.textContent = `Searching open lobby for online player... (${secondsLeft}s)`;
    triggerHaptic(20);

    if (quickMatchTimer) clearInterval(quickMatchTimer);

    quickMatchTimer = setInterval(async () => {
      secondsLeft--;
      if (net.isConnected) {
        clearInterval(quickMatchTimer!);
        return;
      }

      if (secondsLeft > 0) {
        lobbyStatusMsg.textContent = `Searching open lobby for online player... (${secondsLeft}s)`;
      } else {
        clearInterval(quickMatchTimer!);
        quickMatchTimer = null;
        const waitingRoomId = net.role === 'host' ? net.roomId : null;
        if (waitingRoomId) {
          try {
            await fetch('/api/lobby', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ peerId: `gb-room-${waitingRoomId}`, action: 'cancel' })
            });
          } catch (e) {
            console.warn('Lobby cancellation error:', e);
          }
        }
        if (net.isConnected) return;
        net.disconnect();
        // Auto-match challenger bot fallback so player never waits forever
        p2pModal.style.display = 'none';
        lobbyStatusText.style.display = 'none';
        currentMode = 'bot';
        activePlayerId = 'player';
        btnModeBot.classList.add('active');
        btnModeHotseat.classList.remove('active');
        btnDiff.style.display = 'flex';
        bot.setDifficulty('nightmare');
        diffLabel.textContent = 'NIGHTMARE';
        showAiToast('NO PLAYER ONLINE. STARTING CHALLENGER BOT MATCH!');
        triggerHaptic(30);
      }
    }, 1000);

    try {
      const match = await net.findPublicMatch();
      if (match.role === 'guest') {
        lobbyStatusMsg.textContent = 'Found opponent! Connecting to match...';
      } else {
        lobbyStatusMsg.textContent = `Waiting in open lobby for next player... (${secondsLeft}s)`;
      }
    } catch (e) {
      lobbyStatusMsg.textContent = 'Lobby unavailable. Share invite link below!';
      console.warn('Lobby error:', e);
    }
  });

  btnCloseP2p.addEventListener('click', () => {
    p2pModal.style.display = 'none';
  });

  btnCopyInvite.addEventListener('click', () => {
    if (inviteUrlInput.value) {
      navigator.clipboard.writeText(inviteUrlInput.value).then(() => {
        btnCopyInvite.textContent = 'COPIED!';
        setTimeout(() => (btnCopyInvite.textContent = 'COPY'), 2000);
      });
      triggerHaptic(20);
    }
  });

  btnJoinCode.addEventListener('click', () => {
    const code = joinCodeInput.value.trim();
    if (code) joinOnlineRoom(code);
  });

  btnLocalPass.addEventListener('click', () => {
    p2pModal.style.display = 'none';
    currentMode = 'hotseat';
    activePlayerId = 'player';
    renderer.isFlipped = false;
    btnModeBot.classList.remove('active');
    btnModeHotseat.classList.add('active');
    btnDiff.style.display = 'none';
    net.disconnect();
    restartMatch();
    showAiToast('LOCAL PASS & PLAY MODE');
  });

  btnSound.addEventListener('click', () => {
    const muted = sound.toggleMute();
    soundIcon.className = muted ? 'hn hn-bell-mute' : 'hn hn-bell';
  });

  // Jazz MIDI Music controls
  jazz.onTrackChange = (title) => {
    musicTrackTitle.textContent = title.toUpperCase();
  };

  btnMusicToggle.addEventListener('click', () => {
    const isPlaying = jazz.togglePlay();
    btnMusicToggle.classList.toggle('paused', !isPlaying);
    musicNote.textContent = isPlaying ? '🎷' : '🔇';
    triggerHaptic(15);
  });

  btnMusicNext.addEventListener('click', () => {
    const nextTitle = jazz.nextTrack();
    musicTrackTitle.textContent = nextTitle.toUpperCase();
    btnMusicToggle.classList.remove('paused');
    musicNote.textContent = '🎷';
    showAiToast(`TRACK: ${nextTitle.toUpperCase()}`);
    triggerHaptic(20);
  });

  btnMusicShuffle.addEventListener('click', () => {
    const nextTitle = jazz.pickRandomTrack();
    musicTrackTitle.textContent = nextTitle.toUpperCase();
    btnMusicToggle.classList.remove('paused');
    musicNote.textContent = '🎷';
    showAiToast(`SHUFFLED: ${nextTitle.toUpperCase()}`);
    triggerHaptic(20);
  });

  btnRestart.addEventListener('click', () => {
    if (currentMode === 'p2p-guest') {
      showAiToast('HOST CONTROLS RESTART');
      return;
    }
    restartMatch();
  });
  btnRematch.addEventListener('click', () => {
    gameOverModal.style.display = 'none';
    if (net.isConnected) net.sendRematch();
    restartMatch();
  });
}

function restartMatch(): void {
  sim = new GameSim(Date.now() % 100000);
  bot = new BotAI('enemy', currentDifficulty);
  activeAlertText = null;
  deselectCard();
  deselectKing();
  setupDeckUI();
  gameOverModal.style.display = 'none';

  // Randomize jazz song for every new match!
  const newSong = jazz.pickRandomTrack();
  musicTrackTitle.textContent = newSong.toUpperCase();
  btnMusicToggle.classList.remove('paused');
  musicNote.textContent = '🎷';
  lastTime = performance.now();
  tickAccumulator = 0;
  syncBroadcastTimer = 0;
}

let lastTime = performance.now();
let tickAccumulator = 0;

function gameLoop(now: number): void {
  const deltaMs = Math.max(0, now - lastTime);
  lastTime = now;
  const dt = (deltaMs / 1000) * speedMultiplier;

  tickAccumulator += dt;
  syncBroadcastTimer += dt;

  let processedTicks = 0;
  while (tickAccumulator >= 0.1 && processedTicks < MAX_CATCH_UP_TICKS) {
    tickAccumulator -= 0.1;
    processedTicks++;

    if (!sim.isGameOver && currentMode !== 'p2p-guest') {
      // Bot AI update in VS BOT mode
      if (currentMode === 'bot') {
        const botIntent = bot.update(sim);
        if (botIntent) {
          const ok = sim.deployPiece(botIntent.playerId, botIntent.cardId, botIntent.col, botIntent.row);
          if (ok) {
            const def = CHESS_PIECES[botIntent.cardId];
            if (def) {
              showAiToast(`BOT DEPLOYED ${def.name.toUpperCase()}`);
            }
          }
        }
      }

      const evs = sim.step();
      renderer.pushEvents(evs, sim.getSnapshot());

      for (const ev of evs) {
        if (ev.type === 'attack') {
          if (ev.isFlanked) sound.playFlank();
          else sound.playAttack('melee');
        } else if (ev.type === 'bounty') {
          sound.playBounty();
        } else if (ev.type === 'king_damage') {
          sound.playBreakthrough();
          triggerHaptic(40);
        } else if (ev.type === 'pawn_promote') {
          sound.playPromotion();
          triggerHaptic(50);
          showAiToast('PAWN PROMOTED TO QUEEN!');
        } else if (ev.type === 'overtime_start') sound.playOvertime();
        else if (ev.type === 'game_over') {
          sound.playGameOver(ev.winner);
          showGameOverModal(ev.winner, ev.reason);
        }
      }

      if (currentMode === 'p2p-host' && syncBroadcastTimer >= 0.1) {
        syncBroadcastTimer = 0;
        net.sendSync(sim.getSnapshot(), evs);
      }
    }
  }

  updateHUD();
  const snap = sim.getSnapshot();
  renderer.render(snap, Math.min(dt, 0.1));

  requestAnimationFrame(gameLoop);
}

function updateHUD(): void {
  const pState = sim.player;
  const eState = sim.enemy;
  const activeState = activePlayerId === 'enemy' ? eState : pState;

  // Essence
  const ess = Math.floor(activeState.essence);
  essenceNum.textContent = `${ess} / 100`;
  essenceBar.style.width = `${Math.min(100, ess)}%`;

  // King Health: playerCore is ALWAYS YOUR KING, enemyCore is ALWAYS OPPONENT/BOT KING
  const myKing = activePlayerId === 'enemy' ? sim.enemyKing : sim.playerKing;
  const opponentKing = activePlayerId === 'enemy' ? sim.playerKing : sim.enemyKing;

  enemyCoreNum.textContent = `${Math.max(0, Math.round(opponentKing.hp))}`;
  enemyCoreBar.style.width = `${Math.max(0, Math.min(100, (opponentKing.hp / 200) * 100))}%`;

  playerCoreNum.textContent = `${Math.max(0, Math.round(myKing.hp))}`;
  playerCoreBar.style.width = `${Math.max(0, Math.min(100, (myKing.hp / 200) * 100))}%`;

  // Clock
  if (sim.isOvertime) {
    overtimeBadge.style.display = 'block';
    const remainingOt = Math.max(0, (sim.matchDuration + sim.overtimeDuration) - sim.matchTime);
    const m = Math.floor(remainingOt / 60);
    const s = Math.floor(remainingOt % 60);
    matchClock.textContent = `+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    overtimeBadge.style.display = 'none';
    const remaining = Math.max(0, sim.matchDuration - sim.matchTime);
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    matchClock.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Card status
  document.querySelectorAll('.card-item').forEach((el) => {
    const cardId = (el as HTMLElement).dataset.cardId;
    if (!cardId) return;

    const def = CHESS_PIECES[cardId];
    if (!def) return;

    const cd = activeState.cooldowns[cardId] ?? 0;
    const cdOverlay = el.querySelector('.cooldown-overlay') as HTMLElement;

    if (cd > 0) {
      cdOverlay.style.display = 'flex';
      cdOverlay.textContent = cd.toFixed(1);
      el.classList.add('disabled');
    } else {
      cdOverlay.style.display = 'none';
      if (activeState.essence < def.cost) el.classList.add('disabled');
      else el.classList.remove('disabled');
    }
  });
}

function showGameOverModal(winner: 'player' | 'enemy' | 'draw', reason: string): void {
  const isPlayerWinner =
    (activePlayerId === 'player' && winner === 'player') ||
    (activePlayerId === 'enemy' && winner === 'enemy');

  if (winner === 'draw') {
    modalVerdict.textContent = 'DRAW';
    modalVerdict.style.color = 'var(--pal-gold)';
  } else if (isPlayerWinner) {
    modalVerdict.textContent = 'CHECKMATE! VICTORY';
    modalVerdict.style.color = 'var(--pal-rot)';
  } else {
    modalVerdict.textContent = 'KING CAPTURED! DEFEAT';
    modalVerdict.style.color = 'var(--pal-danger)';
  }

  modalReason.textContent = reason;
  statPHp.textContent = `${Math.round(sim.playerKing.hp)}`;
  statEHp.textContent = `${Math.round(sim.enemyKing.hp)}`;

  const m = Math.floor(sim.matchTime / 60);
  const s = Math.floor(sim.matchTime % 60);
  statDuration.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  gameOverModal.style.display = 'flex';
}

window.addEventListener('DOMContentLoaded', init);
