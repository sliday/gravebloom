// Cloudflare Pages Function for Real-time Lobby Matchmaking
interface Env {
  GAME_COORDINATOR: DurableObjectNamespace;
}

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

  const coordinator = context.env.GAME_COORDINATOR.getByName('lobby');
  return coordinator.fetch(request);
};
