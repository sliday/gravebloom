export interface WaitingHost {
  peerId: string;
  time: number;
}

export type LobbyAction = 'join' | 'cancel';

export interface LobbyResult {
  waitingHost: WaitingHost | null;
  response: { status: 'waiting' | 'matched' | 'cancelled'; hostPeerId?: string };
}

export function updateLobby(
  waitingHost: WaitingHost | null,
  peerId: string,
  action: LobbyAction,
  now: number
): LobbyResult {
  const activeHost = waitingHost && now - waitingHost.time <= 25000 ? waitingHost : null;

  if (action === 'cancel') {
    return {
      waitingHost: activeHost?.peerId === peerId ? null : activeHost,
      response: { status: 'cancelled' }
    };
  }

  if (activeHost && activeHost.peerId !== peerId) {
    return {
      waitingHost: null,
      response: { status: 'matched', hostPeerId: activeHost.peerId }
    };
  }

  return {
    waitingHost: { peerId, time: now },
    response: { status: 'waiting' }
  };
}

export function updatePresence(
  activeClients: Record<string, number>,
  sessionKey: string | null,
  now: number
): { activeClients: Record<string, number>; onlineCount: number } {
  const nextClients = Object.fromEntries(
    Object.entries(activeClients).filter(([, lastSeen]) => now - lastSeen <= 16000)
  );

  if (sessionKey) nextClients[sessionKey] = now;

  return {
    activeClients: nextClients,
    onlineCount: Math.max(1, Object.keys(nextClients).length)
  };
}
