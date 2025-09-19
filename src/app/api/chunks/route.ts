import { NextResponse } from 'next/server';
import { PrismaClient, ChunkStatus } from '@prisma/client';
import { getSignedUrl } from '@/lib/gcs';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get('sourceId');
    const limitParam = searchParams.get('limit');

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
    }

    const limit = limitParam ? Number(limitParam) : 50;

    const chunks = await prisma.audioChunk.findMany({
      where: { sourceId, status: ChunkStatus.AVAILABLE },
      orderBy: { index: 'asc' },
      take: Number.isFinite(limit) && limit > 0 ? limit : 50,
    });

    const withUrls = await Promise.all(
      chunks.map(async (c) => ({
        ...c,
        url: await getSignedUrl(c.storageUri),
      }))
    );

    return NextResponse.json(withUrls);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
