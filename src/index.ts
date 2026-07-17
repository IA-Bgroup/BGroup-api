import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { isAllowedOrigin } from './config/origins';
import type { Bindings, Variables } from './types/bindings';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', secureHeaders());

app.use('*', async (c, next) => {
  // cf-ray is useful Cloudflare metadata, but it is not used as our
  // application request ID because request headers are an untrusted input.
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  try {
    await next();
  } finally {
    c.header('X-Request-Id', requestId);
  }
});

app.use('*', (c, next) => {
  const configuredOrigins = c.env.ALLOWED_ORIGINS ?? '';

  return cors({
    origin: (origin) => (isAllowedOrigin(origin, configuredOrigins) ? origin : null),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600,
  })(c, next);
});

app.get('/', (c) =>
  c.json({
    name: 'bgroup-api',
    version: '0.1.0',
    environment: c.env.APP_ENV,
    endpoints: {
      health: '/health',
      readiness: '/ready',
      api: '/api/v1',
    },
  })
);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'bgroup-api',
  })
);

app.get('/ready', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1 AS ready').first();
    return c.json({ status: 'ready', database: 'ok' });
  } catch (error) {
    console.error('Readiness check failed', {
      requestId: c.get('requestId'),
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ status: 'unavailable', database: 'error' }, 503);
  }
});

const api = new Hono<{ Bindings: Bindings; Variables: Variables }>();

api.get('/', (c) =>
  c.json({
    version: 'v1',
    message: 'Add feature routes under /api/v1.',
  })
);

app.route('/api/v1', api);

app.notFound((c) =>
  c.json(
    {
      error: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: c.get('requestId'),
    },
    404
  )
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  console.error('Unhandled request error', {
    requestId: c.get('requestId'),
    error: error.message,
  });

  return c.json(
    {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      requestId: c.get('requestId'),
    },
    500
  );
});

export { app };
export default app;
