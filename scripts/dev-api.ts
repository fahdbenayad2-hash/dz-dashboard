import type { Plugin } from 'vite';
export function devApi(): Plugin {
  return {
    name: 'dz-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = (req.url || '').split('?')[0];
        const files: Record<string, string> = { '/api/session': '/api/session.ts', '/api/data': '/api/data.ts', '/api/telegram-bot': '/api/telegram-bot.ts', '/api/notification-test': '/api/notification-test.ts' };
        if (!files[route]) return next();
        try {
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 16384) { res.statusCode = 413; res.end(); return; } chunks.push(Buffer.from(chunk)); }
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
          const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body });
          const module = await server.ssrLoadModule(files[route]);
          let response: Response;
          if (route === '/api/data' && process.env.DZ_DEV_FIXTURES === '1') {
            const security = await server.ssrLoadModule('/server/security.ts');
            const fixture = await server.ssrLoadModule('/scripts/dev-fixtures.ts');
            response = await security.authenticated(request) ? Response.json(fixture.fixture()) : new Response('', { status: 401 });
          } else response = await module.default(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch { res.statusCode = 500; res.end('Local API unavailable'); }
      });
    },
  };
}
