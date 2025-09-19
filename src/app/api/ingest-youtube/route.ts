import { NextResponse } from 'next/server';
import { PrismaClient, AudioStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, url, chunkSeconds } = body as {
      title: string;
      description?: string;
      url: string;
      chunkSeconds?: number;
    };

    if (!title || !url) {
      return NextResponse.json({ error: 'title and url are required' }, { status: 400 });
    }

    // 1) Create AudioSource in PROCESSING
    const audioSource = await prisma.audioSource.create({
      data: {
        title,
        description,
        originalUri: url, // storing original YouTube URL
        status: AudioStatus.PROCESSING,
      },
      select: { id: true },
    });

    // 2) Call worker
    const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8081';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const WEBHOOK_URL = process.env.WORKER_WEBHOOK_URL || `${baseUrl}/api/wroker_webhook`;

    const resp = await fetch(`${WORKER_URL}/ingest/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: audioSource.id, // cuid matches Prisma PK
        url,
        chunk_seconds: chunkSeconds ?? Number(process.env.CHUNK_SECONDS ?? 20),
        webhook_url: WEBHOOK_URL,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Worker returned ${resp.status}: ${text}`);
    }
    const { job_id } = (await resp.json()) as { job_id: string };

    // Optional: persist job_id in statusMessage
    await prisma.audioSource.update({
      where: { id: audioSource.id },
      data: { statusMessage: `job:${job_id}` },
    });

    return NextResponse.json({ sourceId: audioSource.id, jobId: job_id }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
