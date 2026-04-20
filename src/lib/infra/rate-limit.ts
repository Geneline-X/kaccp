import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(req: NextRequest, options: RateLimitOptions): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `${req.nextUrl.pathname}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + options.windowMs };
    store.set(key, entry);
  }
  entry.count++;

  if (entry.count > options.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  return null;
}

export const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, max: 10 },
  upload: { windowMs: 60 * 1000, max: 20 },
  api: { windowMs: 60 * 1000, max: 60 },
} as const;
