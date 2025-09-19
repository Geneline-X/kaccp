import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { deleteObject } from '@/lib/gcs';

const prisma = new PrismaClient();

export async function DELETE(req: Request, { params }: { params: Promise<{ chunkId: string }> }) {
  try {
    const { searchParams } = new URL(req.url);
    const purge = searchParams.get('purge') === '1';

    const { chunkId } = await params;
    const chunk = await prisma.audioChunk.findUnique({ where: { id: chunkId } });
    if (!chunk) return NextResponse.json({ error: 'not found' }, { status: 404 });

    if (purge && chunk.storageUri?.startsWith('gs://')) {
      try {
        await deleteObject(chunk.storageUri);
      } catch (e) {
        // ignore storage deletion errors, continue to DB delete
      }
    }

    await prisma.audioChunk.delete({ where: { id: chunkId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
