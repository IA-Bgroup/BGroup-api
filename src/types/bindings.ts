import type { D1Database } from '@cloudflare/workers-types';

export interface Bindings {
  DB: D1Database;
  APP_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  ALLOWED_ORIGINS: string;
}

export interface Variables {
  requestId: string;
}
