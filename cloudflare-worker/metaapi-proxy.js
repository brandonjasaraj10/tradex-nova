export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-MetaAPI-Token, X-Target-URL',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const metaApiToken = request.headers.get('X-MetaAPI-Token');
      const targetUrl = request.headers.get('X-Target-URL');

      if (!metaApiToken || !targetUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing X-MetaAPI-Token or X-Target-URL header' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const proxyHeaders = {
        'auth-token': metaApiToken,
        'Content-Type': 'application/json',
        'User-Agent': 'TradeX-Proxy/1.0',
      };

      const fetchOptions = {
        method: request.method,
        headers: proxyHeaders,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Proxy error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
