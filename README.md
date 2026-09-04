# GRAVEBLOOM

> **Real-Time 1v1 Chess Combat on Cloudflare**  
> **Live Web Build:** [https://gravebloom.pages.dev/](https://gravebloom.pages.dev/)

GRAVEBLOOM transforms standard chess rules into a real-time tactical lane battle on an 8×16 board (two full 8×8 chessboards meeting at the center). Players command an on-board royal King and deploy authentic chess pieces (Pawns, Knights, Bishops, Rooks, Queens) that hunt and checkmate the enemy King.

---

## Key Features

- **Two 8×8 Chessboards (8×16 Grid):**
  - Player territory: Rows 1–8 (White King starts at E1).
  - Enemy territory: Rows 9–16 (Black King starts at E16).
  - Clear midline dividing line separates both boards.
- **Strict Chess Movement & Long-Range Sliding:**
  - Rooks charge up to 8 open squares along files/ranks in one move.
  - Bishops slide up to 8 open squares diagonally in one move.
  - Queens slide up to 8 open squares in all eight directions.
  - Knights leap over obstacles in L-patterns (2+1).
  - Pawns march forward along files and capture diagonally.
- **Pawn Promotion into Queens:**
  - Any pawn reaching the opposing back rank (Row 16 for player, Row 1 for enemy) immediately promotes into a Queen with 280 HP and full-board range.
  - Celebrated with an ascending celestial light pillar and golden shockwaves.
- **Mobile Kings with Autonomous Evasion:**
  - Kings actively evaluate threats across their friendly half. When targeted or cornered, Kings automatically flee to the safest square.
  - Players can tap the King at any time to manually command an evasion move.
  - No abstract core HP: checkmate/capturing the King ends the match immediately.
- **Tactical Bonus System:**
  - **Flanking Bonus (+25% Damage):** Attacks against targets engaged by two or more friendly pieces of the same color deal +25% bonus damage.
  - **Capture Bounties:** Eliminating an enemy piece refunds essence directly (Pawn +5, Knight/Bishop +10, Rook +15, Queen +25).
  - **Connected Pawns (-20% Damage Taken):** Diagonal-adjacent friendly pawns form a chain, granting 20% damage reduction with an animated link-line.
- **Instant WebRTC P2P Multiplayer & Public Lobby:**
  - **Public Lobby Auto-Pairing:** Powered by Cloudflare edge function `/api/lobby`. Matches you with anyone currently looking for a match on the website. Features an 8-second timeout with challenger bot backfill.
  - **Private Invite Links:** Generate unique room URLs (`https://gravebloom.pages.dev/?room=XXXX`) with one-tap clipboard copy and native mobile Web Share integration.
  - **Direct P2P DataChannels:** Sub-20ms direct browser-to-browser connection via WebRTC with Google/Twilio STUN servers.
- **Real-Time Online Presence Counter:**
  - Live header badge (`🟢 N ONLINE`) backed by Cloudflare Pages Function `/api/presence` with persistent device ID and IP deduplication.
- **General MIDI SoundFont Jazz Engine:**
  - Sampled electric piano, acoustic upright bass, and tenor saxophone playing 9 jazz standards (Autumn Leaves, Take Five, Blue Bossa, Fly Me to the Moon, Cantaloupe Island, So What, Moanin', The Girl from Ipanema, Spain).
  - Automatically randomizes the background song on entrance and every match restart.
  - Controlled via a vertical sidebar dock on the right side of the playfield.
- **Mobile-First Ergonomics:**
  - `100dvh` viewport lock with safe-area insets.
  - Drag-and-drop deployment: drag pieces directly from the bottom hand onto the board, or use standard two-tap placement.
  - Pixel-accurate hover highlights and centered contact drop shadows.

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | TypeScript, HTML5 Canvas (60 fps interpolation), Web Audio API |
| Build Tool | Vite, TypeScript (ES2022) |
| Unit Testing | Vitest (13 passing tests) |
| Audio Engine | Web Audio API + SoundFont Sampler (`smplr`) |
| Networking | WebRTC DataChannels (`peerjs`) + Cloudflare Pages Functions |
| Visual Assets | `pixel_chess_v1.1` (itch.io 32×32 pixel chess sprites) |
| Typography | Google Fonts (`Chakra Petch` + `Rajdhani`) |
| Deployment | Cloudflare Pages edge network (`wrangler`) |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Run unit test suite
npm test

# 4. Build for production
npm run build

# 5. Preview production build locally
npm run preview
```

---

## Deployment to Cloudflare Pages

```bash
# Deploy production build to Cloudflare Pages
npx wrangler pages deploy dist --project-name gravebloom --branch main
```

---

## Project Structure

```
├── functions/
│   └── api/
│       ├── lobby.ts          # Public lobby matchmaking edge endpoint
│       └── presence.ts       # Real-time online visitor counter endpoint
├── public/
│   └── sprites/              # 32x32 pixel chess sprites (pieces, boards)
├── reports/
│   └── HANDOFF.md            # Comprehensive three-layer architectural report
├── scripts/
│   └── verify-mobile.cjs     # Playwright mobile touch emulation verification
├── src/
│   ├── audio/
│   │   ├── jazz.ts           # SoundFont jazz MIDI synthesizer & 9 tracks
│   │   └── synth.ts          # Procedural Web Audio SFX (combat strikes, fanfare)
│   ├── net/
│   │   └── p2p.ts            # WebRTC DataChannel networking & room signaling
│   ├── sim/
│   │   ├── ai.ts             # Challenger Bot AI & King evasion logic
│   │   ├── board.ts          # 8x16 board geometry, raycasting & chess rules
│   │   ├── harness.ts        # Automated batch simulation runner
│   │   ├── sim.test.ts       # Vitest unit test suite (13 tests)
│   │   ├── sim.ts            # Deterministic 10 Hz simulation engine
│   │   ├── types.ts          # TypeScript domain definitions
│   │   └── units.ts          # Chess piece catalog & stats
│   ├── ui/
│   │   ├── icons.ts          # HackerNoon pixel icons integration
│   │   ├── renderer.ts       # 60 fps canvas renderer, trails, coronation VFX
│   │   └── sprites.ts        # Sprite asset preloader & manager
│   ├── main.ts               # App entrypoint, input handling & UI orchestration
│   └── style.css             # Dark neon stylesheet & responsive layout
├── GDD.md                    # Official Game Design Document (v0.2)
├── index.html                # Main PWA HTML shell
├── package.json              # Dependencies and build scripts
├── tsconfig.json             # Strict TypeScript compiler options
└── vite.config.ts            # Vite bundler configuration
```

---

## License

MIT License. Assets derived from open-source pixel chess resources.
