import { NextResponse } from 'next/server';
import { PrismaClient, AudioStatus, ChunkStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Optional protection: if MANUAL_IMPORT_TOKEN is set, require Authorization: Bearer <token>
function verifyToken(req: Request) {
  const required = process.env.MANUAL_IMPORT_TOKEN;
  if (!required) return true;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return Boolean(token && token === required);
}

export async function POST(req: Request) {
  try {
    if (!verifyToken(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const createIfMissing = url.searchParams.get('CREATE_IF_MISSING') === '1';

    const body = await req.json();
    const { sourceId, totalDurationSeconds, chunkSeconds, chunksMeta } = body as {
      sourceId: string;
      totalDurationSeconds?: number | null;
      chunkSeconds?: number | null;
      chunksMeta: Array<{
        index: number;
        startSec: number;
        endSec: number;
        durationSec?: number;
        gcsUri: string;
      }>;
    };

    if (!sourceId || !Array.isArray(chunksMeta) || chunksMeta.length === 0) {
      return NextResponse.json({ error: 'sourceId and non-empty chunksMeta are required' }, { status: 400 });
    }

    let src = await prisma.audioSource.findUnique({ where: { id: sourceId } });
    if (!src) {
      if (!createIfMissing) {
        return NextResponse.json({ error: 'source not found' }, { status: 404 });
      }
      // Create a minimal placeholder source
      src = await prisma.audioSource.create({
        data: {
          id: sourceId,
          title: `Imported ${new Date().toISOString()}`,
          originalUri: 'manual://import',
          status: AudioStatus.PROCESSING,
          statusMessage: 'creating via manual import',
        },
      });
    }

    const total = Math.max(0, Math.floor(totalDurationSeconds ?? 0));
    const cleaned: Array<{
      index: number;
      startSec: number;
      endSec: number;
      durationSec: number;
      gcsUri: string;
    }> = [];

    for (const m of chunksMeta) {
      if (!m || typeof m.index !== 'number' || !m.gcsUri) {
        return NextResponse.json({ error: 'each chunk must include numeric index and gcsUri' }, { status: 400 });
      }
      // Ensure positive index; allow 0-based but normalize later if needed
      const idx = Math.floor(m.index);
      const start = Math.max(0, Math.floor(m.startSec ?? 0));
      const end = Math.max(start, Math.floor(m.endSec ?? (start + (m.durationSec ?? 0))));
      const dur = Math.max(0, Math.floor(m.durationSec ?? (end - start)));
      const uri = String(m.gcsUri);
      if (!uri.startsWith('gs://')) {
        return NextResponse.json({ error: `invalid gcsUri for index ${idx}: must start with gs://` }, { status: 400 });
      }
      cleaned.push({ index: idx, startSec: start, endSec: end, durationSec: dur, gcsUri: uri });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.audioSource.update({
          where: { id: sourceId },
          data: {
            status: AudioStatus.READY,
            totalDurationSeconds: total,
            statusMessage: `manual import complete${chunkSeconds ? ` (chunkSeconds=${chunkSeconds})` : ''}`,
          },
        });

        for (const meta of cleaned) {
          await tx.audioChunk.upsert({
            where: { sourceId_index: { sourceId, index: meta.index } },
            update: {
              startSec: meta.startSec,
              endSec: meta.endSec,
              durationSec: meta.durationSec,
              storageUri: meta.gcsUri,
              status: ChunkStatus.AVAILABLE,
            },
            create: {
              sourceId,
              index: meta.index,
              startSec: meta.startSec,
              endSec: meta.endSec,
              durationSec: meta.durationSec,
              storageUri: meta.gcsUri,
              status: ChunkStatus.AVAILABLE,
            },
          });
        }
      });
    } catch (txErr: any) {
      console.error('manual-import transaction failed', txErr);
      const message = txErr?.message || 'transaction failed';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('manual-import error', e);
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
