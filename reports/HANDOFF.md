# GRAVEBLOOM — Comprehensive Project Handoff Report

**Date:** 2026-09-03  
**Project:** GRAVEBLOOM (Real-Time 1v1 Chess Combat)  
**Live URL:** https://gravebloom.pages.dev/  
**Repository Working Directory:** `/Users/stas/Playground/gemini-3.8-test`  
**Test Status:** 13/13 Vitest tests passing (100%), Playwright mobile emulation verified with 0 console errors.

---

## Layer 1: Problem, Origins & Branches Considered

### 1.1 The Original Bottleneck & Contradictions
The initial prototype (v0.1) struggled with game identity and mechanical conflicts:
- **Abstract Core Hitpoints vs Chess Essence:** The game had off-board "Core HP" (100 HP) and "Breakthrough Damage" (BTD) tokens. This reduced profound chess geometry to an arbitrary tower-defense HP race.
- **Artificial Role Silos:** The original design artificially locked units into rigid roles: "Rot" zombies were exclusively offensive, while "Flora" plants were stationary defenders with non-chess units (Thornwall, Sporebloom).
- **Physical King Absence:** The King was an off-board spectator rather than an active participant on the battlefield.
- **Viewport Obstruction:** On mobile screens, row 1 and row 2 were obscured by floating bottom panels and HUD banners.
- **Audio Clutter:** A 55 Hz sawtooth background oscillator produced an annoying low-frequency hum.

### 1.2 Architectural Branches Considered
- **Branch A: Traditional Turn-Based Web Chess with Action Timers.** Rejected because it sacrificed real-time tactical tension, tempo, and modern mobile appeal.
- **Branch B: Heavy WebGL 3D (Three.js) Port.** Rejected because a 2D canvas with WebGL-accelerated 60 fps interpolation achieved 100% responsive frame-rates with an ultra-lean bundle (< 40 KB gzipped vs multi-megabyte 3D runtimes).
- **Branch C: Centralized WebSocket Game Server.** Considered, but replaced with WebRTC DataChannels (PeerJS) combined with Cloudflare Pages Functions (`/api/lobby` and `/api/presence`). This eliminated server infrastructure costs and latency while providing instant browser-to-browser P2P play.

---

## Layer 2: Solutions, Decisions & Edge Cases

### 2.1 The Two 8×8 Chessboards (8×16 Grid)
- **Geometry:** Two full 8×8 chessboards meet at the center (8 columns A–H × 16 rows = 128 squares).
- **Player Board (Rows 1–8):** White pieces deploy anywhere on unoccupied squares; White King starts at E1.
- **Enemy Board (Rows 9–16):** Black pieces deploy anywhere on unoccupied squares; Black King starts at E16.
- **Midfield Boundary:** An electric cyan dotted line cleanly separates Row 8 and Row 9.

### 2.2 Strict Chess Rules & Movement Execution
- **Zero Piece Overlap Invariant:** Every square on the board contains at most one piece (`sim.getPieceAt(col, row) === undefined`). Deployment or movement onto an occupied square is strictly prohibited.
- **Pawns:** March 1 square forward along their file. Capture strictly diagonally forward. When reaching the opposing back rank (Row 16 for Player, Row 1 for Enemy), pawns immediately undergo **Pawn Promotion into Queens** (280 HP, full orthogonal and diagonal range).
- **Knights:** Leap in strict L-patterns (2+1) over intervening obstacles onto open squares. Features **Predictive Interception AI**: calculates the future trajectory of moving enemy pieces to jump into ambush squares.
- **Rooks:** Charge up to 8 open squares along ranks and files in a single move.
- **Bishops:** Slide up to 8 open squares along diagonals. Features **Standoff Sniper AI**: attacks the King from distance (ranges 2 to 7 squares) and actively kites/retreats if the King approaches within 1 square.
- **Queens:** Slide up to 8 open squares in all eight directions.
- **Kings:** On-board royal commanders. When threatened, Kings autonomously evaluate danger across their half and sprint away to the safest square. Players can also tap the King at any time to manually command an evasion move.

### 2.3 Tactical Bonus System
- **Flanking Bonus (+25% Damage):** When a target is engaged simultaneously by two or more friendly pieces of the same color, attacks deal +25% damage (telegraphed with `FLANKED!` popups). Disallowed in 1v1 duels between different colored pieces.
- **Capture Bounties:** Capturing an enemy piece refunds essence directly into the player's economy (Pawn: +5, Knight/Bishop: +10, Rook: +15, Queen: +25).
- **Connected Pawns (-20% Damage Taken):** Two diagonal-adjacent friendly pawns form a pawn chain, gaining 20% damage reduction with an animated cyan/pink link-line.

### 2.4 Visual & UI Polish
- **Large Pixel Chess Sprites:** Sprites from the itch.io `pixel_chess_v1.1` pack fill 95% of each cell with soft contact shadows, completely removing intrusive colorful circles.
- **Dedicated Top Info Strip:** Bot announcements and deployment guidance banners occupy a single, mutually exclusive top info strip outside the canvas, ensuring rows 1 through 16 are never obstructed.
- **Vertical Side Control Dock:** The Jazz MIDI player, track switcher, SFX mute, and restart buttons sit on a compact vertical sidebar on the right, keeping the top header clean.
- **Drag-and-Drop Deployment:** Players can drag pieces directly from the bottom hand onto board cells, or tap-to-deploy.
- **Coronation Animation:** A golden celestial light pillar, expanding shockwaves, swirling star particles, and a descending royal crown celebrate pawn promotion.

### 2.5 SoundFont & Chiptune Jazz Engine
- Replaced the 55 Hz hum with an authentic SoundFont-powered jazz engine (`src/audio/jazz.ts`).
- Nine classic jazz standards (Autumn Leaves, Take Five, Blue Bossa, Fly Me to the Moon, Cantaloupe Island, So What, Moanin', The Girl from Ipanema, Spain).
- Automatically randomizes the track on entrance and match restarts.
- High-fidelity General MIDI SoundFonts (sampled electric piano, upright bass, tenor sax) with procedural Web Audio fallback.

### 2.6 Edge Infrastructure on Cloudflare
- **Live Presence Tracking (`/api/presence`):** Persistent `localStorage` device IDs and IP deduplication prevent online counter inflation on refresh.
- **Public Lobby Auto-Pairing (`/api/lobby`):** Pairs players across the website automatically, with an 8-second timeout that falls back to a Challenger Bot match so players never wait indefinitely.
- **Private 1v1 Rooms:** Instant unique room URLs (`https://gravebloom.pages.dev/?room=XXXX`) with one-tap clipboard copy and Web Share API integration.

---

## Layer 3: Broader Context & System Impact

- **Code Quality:** Pure TypeScript with strict type checking, zero console errors, 13 passing unit tests in 100ms.
- **Asset Compliance:** 100% self-hosted assets under `public/sprites/` and Google Fonts (`Chakra Petch` and `Rajdhani`).
- **Production Pipeline:** Fully automated via GitLab / Wrangler CLI deployed directly to Cloudflare Pages edge network.
- **Playground Catalog:** Project metadata, category (`game`), maturity tier (`production`), and statistics updated.
