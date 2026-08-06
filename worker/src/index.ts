import { Env } from './types';
import { corsHeaders, json } from './utils';
import { router } from './router';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const responseHeaders = corsHeaders(origin, env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: responseHeaders });
    }

    try {
      return await router(request, env, responseHeaders);
    } catch (error) {
      console.error('Unhandled worker error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return json({ error: 'Internal server error', details: message }, 500, responseHeaders);
    }
  }
};
