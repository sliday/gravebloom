// Pixel Chess Sprite Manager using itch pixel_chess_v1.1 assets
class SpriteManager {
  private images: Map<string, HTMLImageElement> = new Map();
  public isLoaded = false;

  private paths: Record<string, string> = {
    // White / Silver topdown pieces (Flora / defensive plants)
    'white_pawn': '/sprites/pieces/topdown/white/topdown_white_pawn.png',
    'white_knight': '/sprites/pieces/topdown/white/topdown_white_knight.png',
    'white_bishop': '/sprites/pieces/topdown/white/topdown_white_bishop.png',
    'white_rook': '/sprites/pieces/topdown/white/topdown_white_rook.png',
    'white_queen': '/sprites/pieces/topdown/white/topdown_white_queen.png',
    'white_king': '/sprites/pieces/topdown/white/topdown_white_king.png',

    // Black / Onyx topdown pieces (Rot / undead marching units)
    'black_pawn': '/sprites/pieces/topdown/black/topdown_black_pawn.png',
    'black_knight': '/sprites/pieces/topdown/black/topdown_black_knight.png',
    'black_bishop': '/sprites/pieces/topdown/black/topdown_black_bishop.png',
    'black_rook': '/sprites/pieces/topdown/black/topdown_black_rook.png',
    'black_queen': '/sprites/pieces/topdown/black/topdown_black_queen.png',
    'black_king': '/sprites/pieces/topdown/black/topdown_black_king.png',

    // Mini pieces for cards in bottom hand
    'mini_white_pawn': '/sprites/pieces/mini/white/mini_white_pawn.png',
    'mini_white_knight': '/sprites/pieces/mini/white/mini_white_knight.png',
    'mini_white_bishop': '/sprites/pieces/mini/white/mini_white_bishop.png',
    'mini_white_rook': '/sprites/pieces/mini/white/mini_white_rook.png',
    'mini_white_queen': '/sprites/pieces/mini/white/mini_white_queen.png',
    'mini_white_king': '/sprites/pieces/mini/white/mini_white_king.png',

    'mini_black_pawn': '/sprites/pieces/mini/black/mini_black_pawn.png',
    'mini_black_knight': '/sprites/pieces/mini/black/mini_black_knight.png',
    'mini_black_bishop': '/sprites/pieces/mini/black/mini_black_bishop.png',
    'mini_black_rook': '/sprites/pieces/mini/black/mini_black_rook.png',
    'mini_black_queen': '/sprites/pieces/mini/black/mini_black_queen.png',
    'mini_black_king': '/sprites/pieces/mini/black/mini_black_king.png',

    // Outline pieces for ghost placement previews
    'outline_pawn': '/sprites/pieces/topdown/outline/topdown_outline_pawn.png',
    'outline_knight': '/sprites/pieces/topdown/outline/topdown_outline_knight.png',
    'outline_bishop': '/sprites/pieces/topdown/outline/topdown_outline_bishop.png',
    'outline_rook': '/sprites/pieces/topdown/outline/topdown_outline_rook.png',
    'outline_queen': '/sprites/pieces/topdown/outline/topdown_outline_queen.png',
    'outline_king': '/sprites/pieces/topdown/outline/topdown_outline_king.png'
  };

  public loadAll(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();

    const promises: Promise<void>[] = [];

    for (const [key, src] of Object.entries(this.paths)) {
      const p = new Promise<void>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          this.images.set(key, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Could not load sprite: ${src}`);
          resolve();
        };
      });
      promises.push(p);
    }

    return Promise.all(promises).then(() => {
      this.isLoaded = true;
    });
  }

  public get(key: string): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  public getUnitSprite(pattern: string, type: 'rot' | 'flora'): HTMLImageElement | undefined {
    const prefix = type === 'flora' ? 'white' : 'black';
    return this.images.get(`${prefix}_${pattern}`);
  }

  public getMiniSpriteUrl(pattern: string, type: 'rot' | 'flora'): string {
    const prefix = type === 'flora' ? 'white' : 'black';
    return this.paths[`mini_${prefix}_${pattern}`] || '';
  }

  public getOutlineSprite(pattern: string): HTMLImageElement | undefined {
    return this.images.get(`outline_${pattern}`);
  }
}

export const sprites = new SpriteManager();
