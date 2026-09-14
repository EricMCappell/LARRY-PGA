/**
 * Optional fallback: a tiny Cloudflare Worker that fetches ESPN on the app's
 * behalf.
 *
 * Only needed if ESPN blocks wherever the refresh runs. Cloudflare's network is
 * a different set of IPs from Vercel's, so it often works where Vercel doesn't —
 * but test it before relying on it.
 *
 * Deploy:
 *   npx wrangler deploy workers/espn-proxy.js --name espn-proxy
 * Then set ESPN_PROXY to the worker URL (e.g. https://espn-proxy.<you>.workers.dev)
 * in Vercel, or as a GitHub Actions secret.
 *
 * SECRET is a shared password so the worker isn't an open proxy for anyone who
 * finds the URL: set it with `npx wrangler secret put SECRET` and append
 * `?token=<value>` to ESPN_PROXY.
 */

const ALLOWED_HOSTS = new Set(['site.api.espn.com', 'site.web.api.espn.com']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (env.SECRET && url.searchParams.get('token') !== env.SECRET) {
      return new Response('Not found', { status: 404 });
    }
    if (!target) return new Response('Missing ?url=', { status: 400 });

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Bad url', { status: 400 });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response('Host not allowed', { status: 403 });
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  },
};
