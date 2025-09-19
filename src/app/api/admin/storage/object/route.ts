import { NextResponse } from 'next/server';
import { deleteObject } from '@/lib/gcs';

export async function DELETE(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let gsUri: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      gsUri = body?.gsUri || null;
    }
    if (!gsUri) {
      const { searchParams } = new URL(req.url);
      gsUri = searchParams.get('gsUri');
    }

    if (!gsUri || !gsUri.startsWith('gs://')) {
      return NextResponse.json({ error: 'gsUri (gs://...) is required' }, { status: 400 });
    }

    await deleteObject(gsUri);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
