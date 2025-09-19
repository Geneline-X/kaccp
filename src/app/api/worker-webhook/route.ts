import { NextResponse } from 'next/server';
import { PrismaClient, AudioStatus, ChunkStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    // Verify token
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token || token !== process.env.WORKER_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as {
      job_id: string;
      source_id: string;
      status: 'completed' | 'failed';
      chunks?: string[];
      error?: string;
      totalDurationSeconds?: number | null;
      chunkSeconds?: number | null;
      chunksMeta?: Array<{
        index: number; startSec: number; endSec: number; durationSec: number; gcsUri?: string;
      }> | null;
    };

    // Ensure AudioSource exists
    const src = await prisma.audioSource.findUnique({ where: { id: payload.source_id } });
    if (!src) {
      return NextResponse.json({ error: 'source not found' }, { status: 404 });
    }

    if (payload.status === 'failed') {
      await prisma.audioSource.update({
        where: { id: payload.source_id },
        data: {
          status: AudioStatus.FAILED,
          statusMessage: payload.error ?? 'processing failed',
        },
      });
      return NextResponse.json({ ok: true });
    }

    const totalDuration = payload.totalDurationSeconds ?? 0;

    await prisma.$transaction(async (tx) => {
      // Update AudioSource
      await tx.audioSource.update({
        where: { id: payload.source_id },
        data: {
          status: AudioStatus.READY,
          totalDurationSeconds: Math.floor(totalDuration),
          statusMessage: 'processing complete',
        },
      });

      const metas = payload.chunksMeta ?? [];
      for (const meta of metas) {
        if (!meta.gcsUri) continue;
        await tx.audioChunk.upsert({
          where: {
            sourceId_index: { sourceId: payload.source_id, index: meta.index },
          },
          update: {
            startSec: meta.startSec,
            endSec: meta.endSec,
            durationSec: meta.durationSec,
            storageUri: meta.gcsUri,
            status: ChunkStatus.AVAILABLE,
          },
          create: {
            sourceId: payload.source_id,
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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
