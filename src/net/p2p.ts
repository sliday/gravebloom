import { Peer, DataConnection } from 'peerjs';
import { DeployIntent, KingMoveIntent, GameSnapshot, SimEvent } from '../sim/types';

export type NetRole = 'host' | 'guest' | 'offline';

export interface NetMessage {
  type: 'handshake' | 'intent' | 'king_move' | 'sync' | 'event' | 'rematch';
  senderRole: NetRole;
  intent?: DeployIntent;
  kingMove?: KingMoveIntent;
  snapshot?: GameSnapshot;
  events?: SimEvent[];
  seed?: number;
}

const PEER_OPTS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
};

export class P2PNetwork {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  public role: NetRole = 'offline';
  public roomId: string | null = null;
  public isConnected = false;

  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onRemoteIntent?: (intent: DeployIntent) => void;
  public onRemoteKingMove?: (move: KingMoveIntent) => void;
  public onSyncSnapshot?: (snap: GameSnapshot) => void;
  public onRemoteEvents?: (events: SimEvent[]) => void;
  public onRematchRequested?: () => void;

  public hostGame(customRoomId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.role = 'host';
      let isSettled = false;

      const code = customRoomId || Math.floor(1000 + Math.random() * 9000).toString();
      this.roomId = code;
      const peerId = `gb-room-${code}`;

      const peer = new Peer(peerId, PEER_OPTS);
      this.peer = peer;

      peer.on('open', () => {
        if (this.peer !== peer || isSettled) return;
        isSettled = true;
        resolve(code);
      });

      peer.on('error', (err) => {
        console.warn('Peer host error:', err);
        if (this.peer !== peer || isSettled) return;
        isSettled = true;
        if (err.type === 'unavailable-id') {
          // If room ID already held by another peer, connect as guest!
          this.joinGame(code).then(() => resolve(code)).catch(reject);
        } else {
          this.disconnect();
          reject(err);
        }
      });

      peer.on('connection', (connection) => {
        if (this.peer !== peer || this.conn) {
          connection.close();
          return;
        }
        this.conn = connection;
        this.setupConnectionHandlers();
      });
    });
  }

  public joinGame(roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.role = 'guest';
      this.roomId = roomCode.trim();

      const guestPeerId = `gb-guest-${Date.now() % 100000}`;
      const peer = new Peer(guestPeerId, PEER_OPTS);
      this.peer = peer;

      let isHandshakeComplete = false;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

      const triggerAutoHost = () => {
        if (isHandshakeComplete) return;
        isHandshakeComplete = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        console.log(`Host for room ${roomCode} not active yet. Auto-hosting room...`);
        this.hostGame(roomCode).then(() => resolve()).catch(reject);
      };

      peer.on('open', () => {
        if (this.peer !== peer || isHandshakeComplete) return;
        const hostPeerId = `gb-room-${this.roomId}`;
        const connection = peer.connect(hostPeerId, { reliable: true });
        this.conn = connection;

        // Fallback to auto-hosting if host doesn't answer within 3 seconds
        fallbackTimer = setTimeout(triggerAutoHost, 3000);

        this.setupConnectionHandlers();

        connection.on('open', () => {
          if (this.conn !== connection || isHandshakeComplete) return;
          if (fallbackTimer) clearTimeout(fallbackTimer);
          isHandshakeComplete = true;
          connection.send({
            type: 'handshake',
            senderRole: 'guest'
          });
          resolve();
        });

        connection.on('error', (err) => {
          if (this.conn !== connection || isHandshakeComplete) return;
          console.warn('Connection error, auto-hosting:', err);
          triggerAutoHost();
        });
      });

      peer.on('error', (err) => {
        if (this.peer !== peer || isHandshakeComplete) return;
        console.warn('Peer error on join, auto-hosting:', err);
        triggerAutoHost();
      });
    });
  }

  // Instant public matchmaking lobby
  public async findPublicMatch(): Promise<{ role: 'host' | 'guest'; roomId: string }> {
    this.disconnect();
    const myCode = Math.floor(1000 + Math.random() * 9000).toString();
    const myPeerId = `gb-room-${myCode}`;

    try {
      const res = await fetch('/api/lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: myPeerId })
      });

      if (res.ok) {
        const data = (await res.json()) as { status: string; hostPeerId?: string };
        if (data.status === 'matched' && data.hostPeerId) {
          const hostRoomCode = data.hostPeerId.replace('gb-room-', '').replace('gb-guest-', '');
          await this.joinGame(hostRoomCode);
          return { role: 'guest', roomId: hostRoomCode };
        }
      }
    } catch (e) {
      console.warn('Lobby API unavailable, falling back to direct host:', e);
    }

    // If nobody was waiting in lobby, become host
    await this.hostGame(myCode);
    return { role: 'host', roomId: myCode };
  }

  private setupConnectionHandlers(): void {
    const connection = this.conn;
    if (!connection) return;

    const triggerOpen = () => {
      if (this.conn !== connection || this.isConnected) return;
      this.isConnected = true;
      console.log(`[P2P] Connection opened as ${this.role} in room ${this.roomId}`);
      if (this.onConnected) this.onConnected();
    };

    if (connection.open) {
      triggerOpen();
    } else {
      connection.on('open', triggerOpen);
    }

    connection.on('data', (data) => {
      if (this.conn !== connection) return;

      // Any incoming packet proves DataChannel is active and open
      if (!this.isConnected) {
        triggerOpen();
      }

      const msg = data as NetMessage;
      if (msg.type === 'handshake') {
        if (this.role === 'host' && msg.senderRole === 'guest') {
          connection.send({
            type: 'handshake',
            senderRole: 'host'
          });
        }
        return;
      }

      if (msg.type === 'intent' && this.role === 'host' && msg.senderRole === 'guest' && msg.intent && this.onRemoteIntent) {
        this.onRemoteIntent(msg.intent);
      } else if (msg.type === 'king_move' && this.role === 'host' && msg.senderRole === 'guest' && msg.kingMove && this.onRemoteKingMove) {
        this.onRemoteKingMove(msg.kingMove);
      } else if (msg.type === 'sync' && this.role === 'guest' && msg.senderRole === 'host') {
        if (msg.snapshot && this.onSyncSnapshot) this.onSyncSnapshot(msg.snapshot);
        if (msg.events && this.onRemoteEvents) this.onRemoteEvents(msg.events);
      } else if (msg.type === 'event' && this.role === 'guest' && msg.senderRole === 'host' && msg.events && this.onRemoteEvents) {
        this.onRemoteEvents(msg.events);
      } else if (msg.type === 'rematch' && this.onRematchRequested) {
        this.onRematchRequested();
      }
    });

    connection.on('close', () => {
      if (this.conn !== connection) return;
      console.log('[P2P] Connection closed');
      this.conn = null;
      this.isConnected = false;
      if (this.onDisconnected) this.onDisconnected();
    });

    connection.on('error', (err) => {
      if (this.conn !== connection) return;
      console.warn('[P2P] Connection error:', err);
    });
  }

  public sendKingMove(targetCol: number, targetRow: number): void {
    if (!this.conn || !this.isConnected) return;
    this.conn.send({
      type: 'king_move',
      senderRole: this.role,
      kingMove: {
        playerId: 'enemy',
        targetCol,
        targetRow
      }
    });
  }

  public sendIntent(intent: DeployIntent): void {
    if (!this.conn || !this.isConnected) return;
    this.conn.send({
      type: 'intent',
      senderRole: this.role,
      intent
    });
  }

  public sendSync(snapshot: GameSnapshot, events: SimEvent[]): void {
    if (!this.conn || !this.isConnected || this.role !== 'host') return;
    this.conn.send({
      type: 'sync',
      senderRole: 'host',
      snapshot,
      events
    });
  }

  public sendRematch(): void {
    if (!this.conn || !this.isConnected) return;
    this.conn.send({
      type: 'rematch',
      senderRole: this.role
    });
  }

  public disconnect(): void {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    this.isConnected = false;
    this.role = 'offline';
    this.roomId = null;
  }
}

export const net = new P2PNetwork();
