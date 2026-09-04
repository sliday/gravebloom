// Real-time online presence tracker for GRAVEBLOOM on Cloudflare Pages
interface Env {}

// Active sessions: sessionKey (IP + persistent Client ID) -> lastSeenTimestamp
const activeClients = new Map<string, number>();

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

  const now = Date.now();

  // Clean up stale sessions inactive for > 16 seconds
  for (const [key, lastSeen] of activeClients.entries()) {
    if (now - lastSeen > 16000) {
      activeClients.delete(key);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { clientId?: string };
      const ip = request.headers.get('CF-Connecting-IP') || 'local-ip';
      // Strict session deduplication by IP and client device ID
      const sessionKey = ip + '::' + (body.clientId || 'default');
      activeClients.set(sessionKey, now);
    } catch {
      const ip = request.headers.get('CF-Connecting-IP') || 'local-ip';
      activeClients.set(ip + '::fallback', now);
    }
  }

  // Active unique online visitors
  const onlineCount = Math.max(1, activeClients.size);

  return new Response(
    JSON.stringify({
      status: 'ok',
      onlineCount,
      timestamp: now
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
};
