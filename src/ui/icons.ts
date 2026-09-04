// Helper to provide HackerNoon pixel icons and SVG definitions

export const PIXEL_ICONS: Record<string, string> = {
  // Unit Glyphs
  pawn: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M10 2h4v4h-4zM8 7h8v3H8zM9 11h6v6H9zM6 18h12v4H6z"/></svg>`,
  knight: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 2h6v2h2v4h-2v2h4v3h-2v2h-2v2h4v5H6v-3h2v-4H6V9h2V5h2V2z"/></svg>`,
  bishop: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 2h2v2h-2zm-2 3h6v2H9zm-2 3h10v5H7zm2 6h6v3H9zm-3 4h12v4H6z"/></svg>`,
  rook: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 2h3v3h2V2h4v3h2V2h3v5h-2v3h1v7h-1v2H5v-2H4v-7h1V7H3V2h2zm2 7v5h10V9H7z"/></svg>`,
  queen: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 3h2v3H4zm7-1h2v3h-2zm7 1h2v3h-2zM3 8h18l-3 7H6zm3 9h12v2H6zm-2 4h16v2H4z"/></svg>`,
  king: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 1h2v2h2v2h-2v2h-2V5H9V3h2zm-4 7h10l2 6H5zm2 8h8v3H9zm-3 5h12v2H6z"/></svg>`,

  // UI Icons
  heart: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 4h4v3H4zm12 0h4v3h-4zM2 7h20v6h-3v3h-3v3h-4v3h-2v-3H6v-3H3v-3H2z"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2h6v8h-4v2h4l-8 10v-8h4v-2h-4z"/></svg>`,
  spore: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 3h2v3h-2zm-6 6h3v2H5zm11 0h3v2h-3zm-6 3h4v4h-4zm-4 6h12v3H6z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M4 2h16v10c0 5-4 9-8 10-4-1-8-5-8-10V2zm3 3v7c0 3 2 6 5 7 3-1 5-4 5-7V5H7z"/></svg>`,
  skull: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 3h12v4h3v8h-3v3h-2v3h-2v-2h-2v2H9v-3H7v-3H4V7h2V3zm2 6v4h3V9H8zm5 0v4h3V9h-3z"/></svg>`,
  plant: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 2h2v4h-2zm-5 4h4v3H6zm8 0h4v3h-4zm-3 5h2v8h-2zm-5 4h4v2H6zm8 0h4v2h-4zm-6 6h8v2H8z"/></svg>`,
  bot: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11 2h2v3h-2zM4 6h16v11H4zm3 3h3v3H7zm7 0h3v3h-3zm-5 5h6v1H9zM2 10h2v4H2zm18 0h2v4h-2zm-12 8h8v2H8z"/></svg>`,
  pvp: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6zM9 9h6v6H9z"/></svg>`,
  soundOn: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 8h4l5-5v18l-5-5H3zm13-1h2v10h-2zm3-3h2v16h-2z"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M3 8h4l5-5v18l-5-5H3zm12 1l6 6m0-6l-6 6"/></svg>`
};

export function getUnitPatternIcon(pattern: string): string {
  switch (pattern) {
    case 'pawn':
      return PIXEL_ICONS.pawn;
    case 'knight':
      return PIXEL_ICONS.knight;
    case 'bishop':
      return PIXEL_ICONS.bishop;
    case 'rook':
      return PIXEL_ICONS.rook;
    case 'queen':
      return PIXEL_ICONS.queen;
    case 'king':
      return PIXEL_ICONS.king;
    default:
      return PIXEL_ICONS.shield;
  }
}
