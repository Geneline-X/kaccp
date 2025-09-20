import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSignedUrl } from '@/lib/gcs'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)
    const skip = (page - 1) * pageSize

    // Auto-release expired assignments before listing
    const now = new Date()
    const expired = await prisma.chunkAssignment.findMany({
      where: { releasedAt: null, expiresAt: { lt: now } },
      select: { id: true, chunkId: true },
      take: 1000,
    })
    if (expired.length > 0) {
      for (const a of expired) {
        await prisma.$transaction([
          prisma.chunkAssignment.update({ where: { id: a.id }, data: { releasedAt: now } }),
          prisma.audioChunk.update({
            where: { id: a.chunkId },
            data: { status: 'AVAILABLE' },
          }),
        ])
      }
    }

    // Only show chunks that are truly AVAILABLE and have no approved transcription
    // and do NOT have any pending (unreviewed) submissions.
    const where = {
      status: 'AVAILABLE' as const,
      approvedTranscriptionId: null as any,
      NOT: {
        transcriptions: {
          some: {
            submittedAt: { not: null },
            review: null,
          },
        },
      },
    }
    const [total, items] = await Promise.all([
      prisma.audioChunk.count({ where }),
      prisma.audioChunk.findMany({ where, orderBy: [{ createdAt: 'asc' }, { index: 'asc' }], skip, take: pageSize }),
    ])

    const withUrls = await Promise.all(
      items.map(async (c) => ({
        ...c,
        url: await getSignedUrl(c.storageUri).catch(() => null),
      }))
    )

    const res = NextResponse.json({ items: withUrls, page, pageSize, total })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
