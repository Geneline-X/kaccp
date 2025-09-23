import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const CreateAudioSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sourceRef: z.string().optional(),
  originalUri: z.string().url(),
  totalDurationSeconds: z.number().int().nonnegative().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { title, description, sourceRef, originalUri, totalDurationSeconds } = CreateAudioSchema.parse(await req.json())

    const audio = await prisma.audioSource.create({
      data: {
        title,
        description: description ?? null,
        sourceRef: sourceRef ?? null,
        originalUri,
        totalDurationSeconds: totalDurationSeconds ?? 0,
        status: 'UPLOADED',
        uploadedById: admin.id,
      },
    })

    return NextResponse.json({ audio }, { status: 201 })
  } catch (e: any) {
    console.error('admin/audios POST error', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(String(searchParams.get('page') || '1'))) || 1
    const pageSize = Math.min(200, Math.max(1, parseInt(String(searchParams.get('pageSize') || '25')))) || 25
    const skip = (page - 1) * pageSize

    const total = await prisma.audioSource.count()
    const items = await prisma.audioSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
      skip,
      take: pageSize,
    })

    // Progress counts per source via groupBy (sourceId, status)
    const ids = items.map(i => i.id)
    const grouped = ids.length === 0 ? [] : await prisma.audioChunk.groupBy({
      by: ['sourceId', 'status'],
      where: { sourceId: { in: ids } },
      _count: { _all: true },
    })
    const statusBySource: Record<string, Record<string, number>> = {}
    for (const g of grouped as any[]) {
      const sid = g.sourceId as string
      const st = g.status as string
      const c = g._count?._all || 0
      statusBySource[sid] = statusBySource[sid] || {}
      statusBySource[sid][st] = c
    }

    const withProgress = items.map(it => ({
      ...it,
      progress: statusBySource[it.id] || {},
    }))

    return NextResponse.json({ items: withProgress, page, pageSize, total })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
