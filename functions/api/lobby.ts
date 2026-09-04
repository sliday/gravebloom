// Cloudflare Pages Function for Real-time Lobby Matchmaking
interface Env {}

let waitingHost: { peerId: string; time: number } | null = null;

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { peerId: string; action?: string };
      const now = Date.now();

      // Clear stale host (> 25s)
      if (waitingHost && (now - waitingHost.time > 25000 || waitingHost.peerId === body.peerId)) {
        waitingHost = null;
      }

      if (waitingHost && waitingHost.peerId !== body.peerId) {
        // Matched! Return the host to this guest
        const matchedHost = waitingHost.peerId;
        waitingHost = null; // Consumed
        return new Response(JSON.stringify({ status: 'matched', hostPeerId: matchedHost }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } else {
        // Register this player as the waiting host in lobby
        waitingHost = { peerId: body.peerId, time: now };
        return new Response(JSON.stringify({ status: 'waiting' }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
    }
  }

  return new Response(
    JSON.stringify({ status: 'ok', hasWaitingHost: !!waitingHost }),
    {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    }
  );
};
