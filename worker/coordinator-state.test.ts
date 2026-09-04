import { describe, expect, it } from 'vitest';
import { updateLobby, updatePresence } from './coordinator-state';

describe('updateLobby', () => {
  it('registers the first host and consumes it for the next peer', () => {
    const waiting = updateLobby(null, 'gb-room-1000', 'join', 1000);
    expect(waiting).toEqual({
      waitingHost: { peerId: 'gb-room-1000', time: 1000 },
      response: { status: 'waiting' }
    });

    const matched = updateLobby(waiting.waitingHost, 'gb-room-2000', 'join', 2000);
    expect(matched).toEqual({
      waitingHost: null,
      response: { status: 'matched', hostPeerId: 'gb-room-1000' }
    });
  });

  it('refreshes the same host and replaces an expired host', () => {
    const refreshed = updateLobby(
      { peerId: 'gb-room-1000', time: 1000 },
      'gb-room-1000',
      'join',
      2000
    );
    expect(refreshed.waitingHost).toEqual({ peerId: 'gb-room-1000', time: 2000 });

    const replaced = updateLobby(
      { peerId: 'gb-room-1000', time: 1000 },
      'gb-room-2000',
      'join',
      26001
    );
    expect(replaced.waitingHost).toEqual({ peerId: 'gb-room-2000', time: 26001 });
    expect(replaced.response).toEqual({ status: 'waiting' });
  });

  it('cancels only the requesting host', () => {
    const ownCancellation = updateLobby(
      { peerId: 'gb-room-1000', time: 1000 },
      'gb-room-1000',
      'cancel',
      2000
    );
    expect(ownCancellation.waitingHost).toBeNull();

    const otherCancellation = updateLobby(
      { peerId: 'gb-room-1000', time: 1000 },
      'gb-room-2000',
      'cancel',
      2000
    );
    expect(otherCancellation.waitingHost).toEqual({ peerId: 'gb-room-1000', time: 1000 });
  });
});

describe('updatePresence', () => {
  it('deduplicates active sessions and prunes expired sessions', () => {
    const result = updatePresence(
      { active: 10000, expired: 0 },
      'active',
      17000
    );

    expect(result.activeClients).toEqual({ active: 17000 });
    expect(result.onlineCount).toBe(1);
  });

  it('counts distinct active sessions', () => {
    const result = updatePresence({ first: 10000 }, 'second', 12000);
    expect(result.activeClients).toEqual({ first: 10000, second: 12000 });
    expect(result.onlineCount).toBe(2);
  });
});
