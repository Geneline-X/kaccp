import { NextResponse } from 'next/server';
import { PrismaClient, ChunkStatus } from '@prisma/client';
import { getSignedUrl } from '@/lib/gcs';

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(req.url);
    const take = Number(searchParams.get('take') || 100);
    const skip = Number(searchParams.get('skip') || 0);
    const withSigned = searchParams.get('signed') === '1';

    const { id: sourceId } = await params;
    const source = await prisma.audioSource.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!source) return NextResponse.json({ error: 'source not found' }, { status: 404 });

    const [total, chunks] = await Promise.all([
      prisma.audioChunk.count({ where: { sourceId } }),
      prisma.audioChunk.findMany({
        where: { sourceId },
        orderBy: { index: 'asc' },
        take: Number.isFinite(take) && take > 0 ? take : 100,
        skip: Number.isFinite(skip) && skip >= 0 ? skip : 0,
      }),
    ]);

    if (!withSigned) return NextResponse.json({ items: chunks, total });

    const withUrls = await Promise.all(
      chunks.map(async (c) => ({
        ...c,
        url: await getSignedUrl(c.storageUri),
      }))
    );
    return NextResponse.json({ items: withUrls, total });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'internal error' }, { status: 500 });
  }
}
