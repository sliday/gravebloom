import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeployIntent, GameSnapshot, KingMoveIntent, SimEvent } from '../sim/types';

const peerMocks = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;

  class MockDataConnection {
    public open = false;
    public closed = false;
    public sent: unknown[] = [];
    private handlers = new Map<string, Listener[]>();

    constructor(public peer: string) {}

    public on(event: string, listener: Listener): this {
      const listeners = this.handlers.get(event) ?? [];
      listeners.push(listener);
      this.handlers.set(event, listeners);
      return this;
    }

    public emit(event: string, ...args: unknown[]): void {
      if (event === 'open') this.open = true;
      for (const listener of this.handlers.get(event) ?? []) listener(...args);
    }

    public send(data: unknown): void {
      this.sent.push(data);
    }

    public close(): void {
      this.closed = true;
      this.open = false;
    }
  }

  const peers: MockPeer[] = [];

  class MockPeer {
    public destroyed = false;
    public outgoing: MockDataConnection | null = null;
    private handlers = new Map<string, Listener[]>();

    constructor(public id: string) {
      peers.push(this);
    }

    public on(event: string, listener: Listener): this {
      const listeners = this.handlers.get(event) ?? [];
      listeners.push(listener);
      this.handlers.set(event, listeners);
      return this;
    }

    public emit(event: string, ...args: unknown[]): void {
      for (const listener of this.handlers.get(event) ?? []) listener(...args);
    }

    public connect(peer: string): MockDataConnection {
      this.outgoing = new MockDataConnection(peer);
      return this.outgoing;
    }

    public destroy(): void {
      this.destroyed = true;
    }
  }

  return { peers, MockDataConnection, MockPeer };
});

vi.mock('peerjs', () => ({
  Peer: peerMocks.MockPeer,
  DataConnection: peerMocks.MockDataConnection
}));

import { P2PNetwork } from './p2p';

const intent: DeployIntent = {
  playerId: 'enemy',
  cardId: 'piece.pawn',
  col: 2,
  row: 10,
  tick: 1
};

const kingMove: KingMoveIntent = {
  playerId: 'enemy',
  targetCol: 5,
  targetRow: 15
};

function makeSnapshot(): GameSnapshot {
  const player = {
    id: 'player' as const,
    kingHp: 200,
    maxKingHp: 200,
    essence: 20,
    maxEssence: 100,
    deck: ['piece.pawn'],
    cooldowns: {}
  };
  const enemy = { ...player, id: 'enemy' as const };
  const playerKing = {
    uid: 'player-king',
    defId: 'piece.king',
    pieceType: 'king' as const,
    owner: 'player' as const,
    col: 4,
    row: 1,
    hp: 200,
    maxHp: 200,
    moveCooldown: 0,
    attackCooldown: 0
  };
  const enemyKing = {
    ...playerKing,
    uid: 'enemy-king',
    owner: 'enemy' as const,
    row: 16
  };

  return {
    tick: 1,
    timeSeconds: 0.1,
    isOvertime: false,
    isGameOver: false,
    player,
    enemy,
    playerKing,
    enemyKing,
    pieces: [],
    recentEvents: []
  };
}

describe('P2PNetwork transport boundaries', () => {
  beforeEach(() => {
    peerMocks.peers.splice(0);
  });

  it('accepts guest actions only on the host', async () => {
    const network = new P2PNetwork();
    const onIntent = vi.fn();
    const onKingMove = vi.fn();
    network.onRemoteIntent = onIntent;
    network.onRemoteKingMove = onKingMove;

    const hosted = network.hostGame('1234');
    const peer = peerMocks.peers[0];
    peer.emit('open', peer.id);
    await hosted;

    const connection = new peerMocks.MockDataConnection('guest-1');
    peer.emit('connection', connection);
    connection.emit('open');
    connection.emit('data', { type: 'intent', senderRole: 'host', intent });
    connection.emit('data', { type: 'king_move', senderRole: 'offline', kingMove });
    connection.emit('data', { type: 'intent', senderRole: 'guest', intent });
    connection.emit('data', { type: 'king_move', senderRole: 'guest', kingMove });

    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(intent);
    expect(onKingMove).toHaveBeenCalledTimes(1);
    expect(onKingMove).toHaveBeenCalledWith(kingMove);

    const guest = new P2PNetwork();
    const guestIntent = vi.fn();
    guest.onRemoteIntent = guestIntent;
    const joined = guest.joinGame('1234');
    const guestPeer = peerMocks.peers[1];
    guestPeer.emit('open', guestPeer.id);
    guestPeer.outgoing!.emit('open');
    await joined;
    guestPeer.outgoing!.emit('data', { type: 'intent', senderRole: 'guest', intent });

    expect(guestIntent).not.toHaveBeenCalled();
  });

  it('keeps the first active guest and closes extra connections', async () => {
    const network = new P2PNetwork();
    const hosted = network.hostGame('2345');
    const peer = peerMocks.peers[0];
    peer.emit('open', peer.id);
    await hosted;

    const first = new peerMocks.MockDataConnection('guest-1');
    const extra = new peerMocks.MockDataConnection('guest-2');
    peer.emit('connection', first);
    first.emit('open');
    peer.emit('connection', extra);
    network.sendIntent(intent);

    expect(extra.closed).toBe(true);
    expect(first.sent).toContainEqual({ type: 'intent', senderRole: 'host', intent });
  });

  it('dispatches snapshots and events carried by sync messages', async () => {
    const network = new P2PNetwork();
    const onSnapshot = vi.fn();
    const onEvents = vi.fn();
    network.onSyncSnapshot = onSnapshot;
    network.onRemoteEvents = onEvents;

    const joined = network.joinGame('3456');
    const peer = peerMocks.peers[0];
    peer.emit('open', peer.id);
    peer.outgoing!.emit('open');
    await joined;

    const snapshot = makeSnapshot();
    const events: SimEvent[] = [{ type: 'overtime_start' }];
    peer.outgoing!.emit('data', {
      type: 'sync',
      senderRole: 'host',
      snapshot,
      events
    });

    expect(onSnapshot).toHaveBeenCalledWith(snapshot);
    expect(onEvents).toHaveBeenCalledWith(events);
  });

  it('rejects host creation when PeerJS reports a non-collision error', async () => {
    const network = new P2PNetwork();
    const hosted = network.hostGame('4567');
    const peer = peerMocks.peers[0];
    const error = Object.assign(new Error('signaling unavailable'), { type: 'network' });

    peer.emit('error', error);

    await expect(hosted).rejects.toBe(error);
  });

  it('falls back to joining when the requested host ID is taken', async () => {
    const network = new P2PNetwork();
    const hosted = network.hostGame('5678');
    const hostPeer = peerMocks.peers[0];
    const collision = Object.assign(new Error('room exists'), { type: 'unavailable-id' });

    hostPeer.emit('error', collision);
    const guestPeer = peerMocks.peers[1];
    guestPeer.emit('open', guestPeer.id);
    guestPeer.outgoing!.emit('open');

    await expect(hosted).resolves.toBe('5678');
    expect(hostPeer.destroyed).toBe(true);
    expect(network.role).toBe('guest');
  });
});
