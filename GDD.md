# GDD v0.2 — GRAVEBLOOM

> **Genre:** Real-time 1v1 chess-lane combat (Plants-vs-Zombies structure meets dynamic chess movement)  
> **Platform:** Mobile-first browser (portrait PWA), responsive desktop  
> **Target Audience:** 18–35 competitive mobile and strategy players (Clash Royale, chess blitz, tetr.io)  
> **Status:** Revised Draft (v0.2 incorporating verified playtest directives)  
> **Last Updated:** 2026-09-02  
> **Live Deployment:** https://gravebloom.pages.dev/  

---

## 1. Executive Summary

**Elevator Pitch:** An 8×16 portrait battlefield (two full 8×8 chessboards meeting at the center) where chess pieces fight in real time. You command a royal army led by your on-board **King**. Deploy authentic chess pieces (**Pawn, Knight, Bishop, Rook, Queen**) to march forward, hunt, and assassinate the enemy King while protecting your own King. No abstract lives or off-board core HP exist. All pieces hunt the opposing King. When danger approaches, your King can run across friendly territory in all eight directions to evade attackers.

**Unique Selling Points:**
- **On-board Mobile Kings:** The King is an active commander on the board, not a static target. Players tap their King to sprint away from incoming threats or lead counter-attacks.
- **Direct Checkmate Win Condition:** Matches end when a King falls. No arbitrary core hit-points or breakthrough damage tokens.
- **Universal Offence / Defence Deployment:** Every piece type can be deployed offensively (to hunt the enemy King) or defensively (to guard territory and shield friendly pieces). No artificial non-chess units.
- **Instant WebRTC P2P Multiplayer:** Share a unique Cloudflare link (`https://gravebloom.pages.dev/?room=XXXX`) to connect two mobile browsers peer-to-peer with zero installation.
- **Authentic Pixel Chess Presentation:** Crisp topdown and mini pixel chess sprites (from itch.io `pixel_chess_v1.1`) set against a dark-neon tetr.io aesthetic at 60 fps.

---

## 2. Design Pillars

```
Pillar 1: ONE-THUMB MOBILE COMMAND
  Player experience: The full match plays with one thumb in portrait orientation on a phone.
    All interactive zones sit in the bottom 75% of the screen. Matches resolve within 3 minutes.
  Forbids: camera panning, screen scrolling, multi-select, drag-micro.
  Verified by: mobile layout test (100dvh viewport lock; rows 1 through 16 remain completely
    visible with zero overlap behind UI controls).

Pillar 2: PURE CHESS LANGUAGE
  Player experience: Every piece on the board moves, attacks, and reads according to standard chess geometry.
    Pawns stride forward, Knights leap in L-shapes over obstacles, Bishops strike on diagonals,
    Rooks charge files, Queens cleave adjacent cells, Kings run in all 8 directions.
  Forbids: non-chess units (no generic walls, arbitrary sparkles, or homing projectiles).
  Verified by: unit catalog contains exactly the 6 classic chess piece types.

Pillar 3: KING ASSASSINATION (CHECKMATE ONLY)
  Player experience: The objective is clear and visceral. Eliminate the enemy King while keeping your King alive.
    Threatened Kings must retreat, reposition behind defenders, or strike back in melee.
  Forbids: abstract base health, off-board core counters, timer-stall victories.
  Verified by: game terminates immediately when King HP reaches zero.

Pillar 4: DARK NEON CLARITY
  Player experience: High-contrast palette (#0B0E13 base, #39D0FF player cyan, #FF4FD8 enemy magenta,
    #FFE600 royal gold aura) with 32x32 pixel sprites rendered with nearest-neighbor crispness.
  Forbids: visual clutter, muddy textures, illegible fonts.
  Verified by: Rajdhani & Chakra Petch typography and 0 console errors across all device profiles.
```

---

## 3. Core Loop

```
        ┌────────────────────────────────────────────────────────┐
        ▼                                                        │
  GENERATE essence over time (4.0 essence/s, max 100)           │
        │                                                        │
        ▼                                                        │
  READ threat posture (enemy King location, incoming attackers)  │
        │                                                        │
        ▼                                                        │
  DECIDE action:                                                 │
    · Stance: [⚔️ OFFENCE] to hunt enemy King                    │
    · Stance: [🛡️ DEFENCE] to guard friendly King                │
    · Evade: Tap friendly King to sprint away from danger        │
        │                                                        │
        ▼                                                        │
  DEPLOY / MOVE (tap piece card → tap highlighted cell)          │
        │                                                        │
        ▼                                                        │
  RESOLVE (pieces hunt the King, combat resolves, checkmate) ────┘
```

**Observe:** Enemy King coordinates, enemy attack vectors, essence meter, card cooldowns.  
**Decide:** Whether to launch an aggressive Queen/Rook offensive push, anchor a defensive line around your King, or reposition your King away from an impending ambush.  
**Act:** Tap a card and tap a legal board cell, or tap your King and tap an adjacent cell to run.  
**Feedback:** Golden King crown halos, attack damage popups, hit particles, procedural synth sounds.  

---

## 4. Match Frame & Board Geography

**Board Dimensions:** 8 columns (A–H) × 16 rows (two full 8×8 chessboards meeting at the center). Total 128 squares.

```
 row 16  ┌──────────────────────┐  [ENEMY KING starts at E16]
         │     ENEMY BOARD      │  Rows 9–16: Enemy 8×8 board (deployment and King roam)
 row  9  │                      │
         ╞═════ MIDFIELD ═══════╡  Midfield dividing boundary (dotted cyan line between rows 8 and 9)
 row  8  │                      │
         │     YOUR BOARD       │  Rows 1–8: Your 8×8 board (deployment and King roam)
 row  1  └──────────────────────┘  [YOUR KING starts at E1]
```

### Initial Placements:
- **Player King:** Starts at column E (col index 4), row 1.
- **Enemy King:** Starts at column E (col index 4), row 16.

### Deployment Territory & Unified Chess Role:
- **Zero Piece Overlap Invariant:** Every square holds at most one piece. Deployment or movement into an occupied square is strictly forbidden.
- **Player Territory:** Any unoccupied square across Rows 1–8 (full 8×8 board).
- **Enemy Territory:** Any unoccupied square across Rows 9–16 (full 8×8 board).
- **Unified Chess Behavior (No Artificial Stance Toggle):** All pieces naturally advance along their chess paths toward the enemy King to attack, while actively engaging and defending whenever an enemy piece enters their attack range.
- **Pawn Promotion:** Any pawn reaching the opposing back rank (Row 16 for Player, Row 1 for Enemy) immediately promotes to a **Queen** (HP 280, full orthogonal and diagonal range).

### Vertical Margin Safety:
Canvas scaling enforces that Row 1 sits at least 18px above the bottom controls, and Row 16 sits at least 18px below the top HUD. No interactive rows ever slide behind HUD panels on mobile devices.

---

## 5. The Kings (System: `kings`)

The King is the center of gravity in every match.

| Attribute | Value | Mechanics |
|---|---|---|
| Starting Position | E1 (Player) / E16 (Enemy) | On-board piece from t = 0 |
| Health Points | 200 HP | No base lives; King HP is the sole match health metric |
| Movement Pattern | 1 square, all 8 directions | Orthogonal and diagonal (classic chess King move) |
| Movement Cooldown | 0.7 second | Responsive tactical evasion |
| Self-Defense Melee | 15 damage / 1.0s | King strikes back against adjacent hostiles |
| Autonomous Evasion | Active | Evaluates danger on all adjacent squares across friendly territory (Rows 1–8) and flees when threatened |
| Win / Loss Trigger | King HP = 0 | Instant match termination (Checkmate) |

### King Tactical Evasion Strategy:
Both Kings possess automated survival evasion:
1. When hostile pieces approach within 2 squares or establish line of sight to the King, the King calculates danger scores for its current cell and all legal adjacent squares across its friendly 8×8 board (Rows 1–8 for Player King, Rows 9–16 for Enemy King).
2. The King selects the square with the lowest threat index and runs away to safety, seeking shelter behind friendly defenders.
3. The player can manually tap the King at any time to override and command an evasion sprint into any legal adjacent square.
   - Clears selection and triggers haptic vibration.
3. Second tap on King cancels movement mode.

### Autonomous Bot King AI:
The computer's King continuously evaluates incoming threat levels:
- If hostile pieces enter a 2-square radius of the Bot King, the bot computes danger scores for all 8 adjacent squares.
- The Bot King selects the square with the lowest threat index and runs away, sheltering behind friendly defenders.

---

## 6. Chess Piece Roster (System: `pieces`)

All units in the game represent authentic chess pieces. Assets derive from the itch.io `pixel_chess_v1.1` collection (32×32 topdown sprites on the board, 16×16 mini sprites in the hand, outline sprites for placement previews).

| Piece | Pattern | Cost | CD | HP | Attack | Move Rate | Tactical Behavior |
|---|---|---|---|---|---|---|---|
| **Pawn** | Straight / Bias | 20 | 3.0s | 70 | 12 dmg / 1.0s | 1 cell / 1.0s | Swarm unit. Marches 1 square along file toward opposing King. Captures diagonally. Promotes to Queen on back rank. |
| **Knight** | L-Jump (2+1) | 45 | 7.0s | 110 | 18 dmg / 1.0s | 1 jump / 1.4s | Infiltration unit. Jumps over blockers and frontlines, landing on any of 8 L-squares. |
| **Bishop** | Diagonal | 35 | 6.0s | 85 | 15 dmg / 1.0s | Up to 8 cells / 0.9s | Agile flanker. Slides along unobstructed diagonals up to 8 cells toward the King. |
| **Rook** | Straight Line | 55 | 10.0s | 190 | 22 dmg / 1.0s | Up to 8 cells / 0.8s | Heavy fortress tank. Charges along unobstructed ranks or files up to 8 cells in one move. |
| **Queen** | Any Direction | 85 | 20.0s | 280 | 26 dmg / 1.0s | Up to 8 cells / 0.9s | Supreme royal attacker. Slides along unobstructed rays up to 8 cells in one move. Max 1 active. |
| **King** | All 8 Directions | — | 0.7s | 200 | 15 dmg / 1.0s | 1 cell / 0.7s | On-board royal commander. Target of all opposing pieces. Runs across friendly half to evade assassination. |

---

## 7. Combat & Tactical Bonus System (System: `combat`)

1. **Targeting Priority & Natural Combat:**
   - Every piece on the board advances toward the enemy King along its chess rules.
   - Rooks, Bishops, and Queens slide along open rays up to 8 cells in a single move.
   - If an enemy piece sits in attack range (diagonally for Pawns, on L-hops for Knights, or along rays for Rooks, Bishops, and Queens), the piece immediately attacks and defends.
   - **Predictive Interception:** Pieces evaluate the future trajectory of moving enemy units to calculate lead-target squares (Knights calculate L-hop ambushes where advancing pawns will step; Rooks shift files to intercept runners).
2. **King Self-Defense & Autonomous Evasion:**
   - Kings actively evaluate danger on all adjacent squares across their friendly half (Rows 1–8 for Player, Rows 9–16 for Enemy).
   - If threatened by approaching pieces or line of sight, the King automatically flees to the safest square.
   - If cornered, the King strikes adjacent attackers for 15 damage every 1.0s.
3. **Tactical Bonuses & Synergies:**
   - **Flanking Bonus (+25% Damage):** When a target is engaged by two or more friendly pieces of the same color simultaneously, attacks deal **+25% Flanking Damage** (telegraphed with `FLANKED!` popups). Does not trigger on 1v1 duels between different colored pieces.
   - **Capture Bounties:** Eliminating an enemy piece immediately refunds essence to the slayer's economy:
     - **Pawn:** +5 essence
     - **Knight / Bishop:** +10 essence
     - **Rook:** +15 essence
     - **Queen:** +25 essence
   - **Connected Pawns (-20% Damage Taken):** Two diagonal-adjacent friendly pawns form a pawn chain. Both gain **20% damage reduction** with a visible cyan/magenta link-line.
4. **Visual Combat Clarity & Motion Effects:**
   - **Enlarged Pieces (95% Cell Size):** Heavy baseplate circles removed. Pieces feature soft, natural drop-shadows and fill 95% of each square.
   - **Weak Pathfinding Lines:** Faint, subtle dashed lines (`alpha: 0.25`) indicate only the immediate legal next step or hop for each piece, eliminating confusing rays.
   - **Targeting Tethers:** Dynamic animated neon lines connect each attacking piece to its target (enemy pieces or King).
   - **Coronation Animation (Pawn → Queen):** Ascension light pillar, expanding shockwaves, swirling star particles, and a descending golden royal crown celebrate pawn promotion.
   - **Combat Strikes:** Distinct visual strike animations play on contact (Queen sweeping beam, Rook battering blast, Bishop diagonal laser, Knight crescent slash, Pawn puncture).
5. **Speed & Modifiers:**
   - Movement and combat run at 10 Hz deterministic ticks.
   - Sliding pieces (Rook, Bishop, Queen) slide up to 8 open cells along unobstructed rays in a single move.

---

## 8. Economy (System: `economy`)

- **Starting Essence:** 35 essence.
- **Base Regeneration:** 4.0 essence per second (0.4 essence per tick).
- **Overtime Regeneration:** 8.0 essence per second (triggers at 3:00 if both Kings survive).
- **Essence Cap:** 100 essence (prevents bank-and-dump blowouts).
- **Capture Income:** Active kills refund +5 to +25 essence via the Capture Bounty system.
- **Dual Constraint:** Deploying a piece requires both sufficient essence and an expired individual card cooldown.

---

## 9. Controls & User Interface (System: `ui`)

### Mobile Portrait Layout:
- **Top Status Bar (36px):**
  - Brand Title: `GRAVEBLOOM` with crown icon.
  - Difficulty Toggle: cycles `APPRENTICE` (default, 18s opening delay buffer), `TACTICAL`, `NIGHTMARE`.
  - Game Modes: `VS BOT` (solo computer AI), `1v1 LOBBY` (public auto-matchmaking / private link).
- **Vertical Side Control Dock:**
  - Positioned on the right side of the playfield.
  - Vertical Jazz MIDI Player (`🎷`, vertical track title, `▼` next track).
  - Audio SFX toggle (`🔔`).
  - Match restart button (`🔄`).
- **King Status HUD (28px):**
  - Bot King HP (200 max) with dynamic gradient bar.
  - Match Clock (`03:00` countdown).
  - Player King HP (200 max) with dynamic cyan gradient bar.
- **Playfield Canvas:**
  - 8×16 grid with clear row numbers (1 to 16) and column letters (A to H).
  - Never obscured by controls. Rows 1 through 16 always 100% visible.
  - Large pixel chess sprites (95% cell size) with soft ambient shadows and luminous contrast rims.
  - Touch/pointer drag-and-drop deployment from the cards directly onto the board.
- **Bottom Controls Panel:**
  - **Essence Meter:** numeric readout (`XX / 100`) + progress gauge + `👑 TAP KING TO RUN` reminder.
  - **Chess Deck Hand:** single row of 5 piece cards (Pawn, Knight, Bishop, Rook, Queen) with real mini pixel icons and cost badges. Drag directly onto the board or tap to deploy.

---

## 10. Peer-to-Peer Online Multiplayer & Public Lobby (System: `p2p`)

### Architecture:
- Built with WebRTC DataChannels using PeerJS and Cloudflare Pages Function `/api/lobby`.
- Hosted on Cloudflare Pages (`https://gravebloom.pages.dev/`).
- Direct browser-to-browser communication with 5–20 ms latency once paired.

### Matchmaking Options:
1. **Public Lobby Auto-Pairing:**
   - Tap **`⚡ FIND OPPONENT (PLAY NOW)`**.
   - Cloudflare edge endpoint `/api/lobby` pairs you with anyone currently looking for a match on the website.
   - If a waiting player is present, you connect as Guest immediately. If no player is waiting, you become the open lobby host and pair with the next entrant.
2. **Private Invite Links:**
   - Tap **`1v1`** to generate a unique room link: `https://gravebloom.pages.dev/?room=XXXX`.
   - Tap **`COPY`** or **`SHARE VIA APPS`** to send to a specific friend.
   - Opening the link auto-connects to that private match.
3. **Local Pass & Play:**
   - Offline hotseat for two players sharing one phone.

---

## 11. Technical Architecture & Budgets

```
Client (Portrait PWA / Web)                     Cloudflare Infrastructure
┌─────────────────────────────────┐   WebRTC   ┌───────────────────────────────┐
│ HTML5 Canvas + Web Audio Synth  │ ◄────────► │ Peer Client (Friend)          │
│ 10 Hz Sim + 60 fps Interpolation│  DataChan  └───────────────────────────────┘
│ TypeScript (Vite + Vitest)      │
└─────────────────────────────────┘
                 ▲
                 │ Static Asset Hosting
                 ▼
┌─────────────────────────────────┐
│ Cloudflare Pages                │
│ https://gravebloom.pages.dev    │
└─────────────────────────────────┘
```

- **Bundle Size:** Initial JS bundle < 40 KB gzipped; CSS < 8 KB gzipped.
- **Sprite Footprint:** 32×32 pixel PNG assets cached locally in `/sprites/`.
- **Audio:** 100% procedural Web Audio API dark synth engine (zero external audio file dependencies).
- **Frame Budget:** 60 fps on iPhone 11 / Pixel 5 and above; tick budget < 1 ms on 10 Hz headless sim.

---

## 12. Verification & Acceptance Criteria

All criteria verified via Vitest automated tests and Playwright mobile emulation:
1. **On-board Kings:** Kings spawn on E1 and E16 with 200 HP at match start.
2. **King Mobility:** Kings move into any adjacent square (all 8 directions) upon player tap.
3. **King Assassination:** Match ends immediately when either King HP reaches zero.
4. **Piece Tracking:** Offensive pieces track and attack the live coordinates of the enemy King.
5. **No Clipping:** Rows 1 through 16 remain completely visible with generous margins above controls.
6. **Unique P2P Links:** Room generation produces valid unique URLs that auto-join upon loading.
7. **Deterministic Sim:** Headless sim reproduces identical state across matching seeds and inputs.
