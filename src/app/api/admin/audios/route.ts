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

    const items = await prisma.audioSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      take: 100,
    })

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
