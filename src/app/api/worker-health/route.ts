import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8081';
    const resp = await fetch(`${WORKER_URL}/health`, { cache: 'no-store' });
    const text = await resp.text();
    // Try JSON first; if not JSON, return as text
    try {
      const json = JSON.parse(text);
      return NextResponse.json({ ok: resp.ok, status: resp.status, body: json });
    } catch {
      return NextResponse.json({ ok: resp.ok, status: resp.status, body: text });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? 'health check failed' }, { status: 500 });
  }
}
