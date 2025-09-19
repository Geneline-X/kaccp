import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { deleteObject } from '@/lib/gcs';

const prisma = new PrismaClient();

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const audio = await prisma.audioSource.findUnique({
      where: { id },
      include: {
        _count: { select: { chunks: true } },
      },
    });
    if (!audio) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ item: audio });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const purge = searchParams.get('purge') === '1';

    const audio = await prisma.audioSource.findUnique({ where: { id }, include: { chunks: true } });
    if (!audio) return NextResponse.json({ error: 'not found' }, { status: 404 });

    // Optionally purge GCS objects first (best-effort)
    if (purge) {
      await Promise.allSettled(
        (audio.chunks || [])
          .filter(c => c.storageUri?.startsWith('gs://'))
          .map(c => deleteObject(c.storageUri).catch(() => {}))
      );
    }

    // Delete chunks then source
    await prisma.$transaction(async (tx) => {
      await tx.audioChunk.deleteMany({ where: { sourceId: id } });
      await tx.audioSource.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
