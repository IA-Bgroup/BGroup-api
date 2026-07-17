import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/types/bindings';

function createBindings(overrides: Partial<Bindings> = {}): Bindings {
  const first = vi.fn().mockResolvedValue({ ready: 1 });
  const prepare = vi.fn().mockReturnValue({ first });

  return {
    APP_ENV: 'test',
    LOG_LEVEL: 'error',
    ALLOWED_ORIGINS: 'http://localhost:5173,https://*.bgroup.pages.dev',
    DB: { prepare } as unknown as D1Database,
    ...overrides,
  };
}

describe('BGroup API', () => {
  it('returns a liveness response', async () => {
    const response = await app.request('/health', {}, createBindings());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'bgroup-api',
    });
    expect(response.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('returns readiness when D1 responds', async () => {
    const response = await app.request('/ready', {}, createBindings());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ready', database: 'ok' });
  });

  it('returns 503 when D1 is unavailable', async () => {
    const first = vi.fn().mockRejectedValue(new Error('D1 unavailable'));
    const prepare = vi.fn().mockReturnValue({ first });
    const bindings = createBindings({ DB: { prepare } as unknown as D1Database });

    const response = await app.request('/ready', {}, bindings);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'unavailable',
      database: 'error',
    });
  });

  it('allows an explicitly configured origin', async () => {
    const response = await app.request(
      '/health',
      { headers: { Origin: 'http://localhost:5173' } },
      createBindings()
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows a one-level preview subdomain', async () => {
    const response = await app.request(
      '/health',
      { headers: { Origin: 'https://feature-123.bgroup.pages.dev' } },
      createBindings()
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://feature-123.bgroup.pages.dev'
    );
  });

  it('blocks origins that only look similar to an allowed origin', async () => {
    const response = await app.request(
      '/health',
      { headers: { Origin: 'https://feature-123.bgroup.pages.dev.evil.example.com' } },
      createBindings()
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns a consistent JSON 404 response', async () => {
    const response = await app.request('/missing', {}, createBindings());
    const body = (await response.json()) as { error: string; requestId: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.requestId).toBeTruthy();
  });
});
