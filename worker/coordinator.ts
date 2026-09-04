import { DurableObject } from 'cloudflare:workers';
import { updateLobby, updatePresence, WaitingHost } from './coordinator-state';

interface Env {}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

export class GameCoordinator extends DurableObject<Env> {
  public async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.endsWith('/lobby')) return this.handleLobby(request);
    if (path.endsWith('/presence')) return this.handlePresence(request);
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  private async handleLobby(request: Request): Promise<Response> {
    if (request.method === 'GET') {
      const waitingHost = await this.ctx.storage.get<WaitingHost>('waitingHost');
      const hasWaitingHost = !!waitingHost && Date.now() - waitingHost.time <= 25000;
      if (waitingHost && !hasWaitingHost) await this.ctx.storage.delete('waitingHost');
      return new Response(JSON.stringify({ status: 'ok', hasWaitingHost }), {
        headers: JSON_HEADERS
      });
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    let body: { peerId?: unknown; action?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    if (typeof body.peerId !== 'string' || !/^gb-room-\d{4}$/.test(body.peerId)) {
      return Response.json({ error: 'invalid_peer_id' }, { status: 400 });
    }
    if (body.action !== undefined && body.action !== 'cancel') {
      return Response.json({ error: 'invalid_action' }, { status: 400 });
    }

    const waitingHost = (await this.ctx.storage.get<WaitingHost>('waitingHost')) ?? null;
    const result = updateLobby(
      waitingHost,
      body.peerId,
      body.action === 'cancel' ? 'cancel' : 'join',
      Date.now()
    );

    if (result.waitingHost) {
      await this.ctx.storage.put('waitingHost', result.waitingHost);
    } else {
      await this.ctx.storage.delete('waitingHost');
    }

    return new Response(JSON.stringify(result.response), { headers: JSON_HEADERS });
  }

  private async handlePresence(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    let clientId = 'default';
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as { clientId?: unknown };
        if (typeof body.clientId === 'string' && body.clientId.length <= 128) {
          clientId = body.clientId;
        }
      } catch {
        clientId = 'fallback';
      }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'local-ip';
    const sessionKey = request.method === 'POST' ? await this.hashSession(`${ip}::${clientId}`) : null;
    const activeClients =
      (await this.ctx.storage.get<Record<string, number>>('activeClients')) ?? {};
    const result = updatePresence(activeClients, sessionKey, Date.now());
    await this.ctx.storage.put('activeClients', result.activeClients);

    return new Response(
      JSON.stringify({ status: 'ok', onlineCount: result.onlineCount, timestamp: Date.now() }),
      { headers: JSON_HEADERS }
    );
  }

  private async hashSession(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}

export default {
  fetch(): Response {
    return Response.json({ status: 'ok' });
  }
} satisfies ExportedHandler<Env>;
