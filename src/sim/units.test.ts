import { describe, expect, it } from 'vitest';
import { CHESS_PIECES, DECK_PIECES } from './units';

describe('deck presentation order', () => {
  it('orders deployable pieces from lowest to highest essence cost', () => {
    const costs = DECK_PIECES.map((cardId) => CHESS_PIECES[cardId].cost);

    expect(costs).toEqual([20, 35, 45, 55, 85]);
  });
});
