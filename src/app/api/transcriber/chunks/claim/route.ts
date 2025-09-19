import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const ClaimSchema = z.object({
  // Optional explicit sourceId to constrain pool
  sourceId: z.string().optional(),
  // Optional specific chunkId the user wants to claim
  chunkId: z.string().optional(),
})

const ASSIGNMENT_MINUTES = parseInt(process.env.ASSIGNMENT_MINUTES || '15', 10)
const MAX_ACTIVE = parseInt(process.env.MAX_ACTIVE_ASSIGNMENTS || '1', 10)
const CLAIM_COOLDOWN_SECONDS = parseInt(process.env.CLAIM_COOLDOWN_SECONDS || '30', 10)

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { sourceId, chunkId } = ClaimSchema.parse(body)

    // Enforce max active assignments for this user
    const now = new Date()
    const active = await prisma.chunkAssignment.findMany({
      where: {
        userId: user.id,
        releasedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { chunk: true },
      orderBy: { createdAt: 'desc' },
    })
    if (active.length >= MAX_ACTIVE) {
      return NextResponse.json({
        error: 'You already have active assignment(s) at the limit',
        assignments: active.map(a => ({ id: a.id, chunkId: a.chunkId, chunk: a.chunk })),
      }, { status: 409 })
    }

    // Cooldown: ensure at least CLAIM_COOLDOWN_SECONDS since last assignment creation
    const lastAssignment = active[0] || (await prisma.chunkAssignment.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }))
    if (lastAssignment?.createdAt) {
      const elapsed = (now.getTime() - new Date(lastAssignment.createdAt).getTime()) / 1000
      if (elapsed < CLAIM_COOLDOWN_SECONDS) {
        return NextResponse.json({ error: 'Please wait before claiming again', retryAfterSeconds: Math.ceil(CLAIM_COOLDOWN_SECONDS - elapsed) }, { status: 429 })
      }
    }

    // Find target available chunk (specific or next)
    const nextChunk = chunkId
      ? await prisma.audioChunk.findFirst({ where: { id: chunkId, status: 'AVAILABLE', ...(sourceId ? { sourceId } : {}) } })
      : await prisma.audioChunk.findFirst({
          where: { status: 'AVAILABLE', ...(sourceId ? { sourceId } : {}) },
          orderBy: [ { createdAt: 'asc' }, { index: 'asc' } ],
        })

    if (!nextChunk) return NextResponse.json({ error: 'No chunks available' }, { status: 404 })

    const expiresAt = new Date(now.getTime() + ASSIGNMENT_MINUTES * 60 * 1000)

    const assignment = await prisma.$transaction(async (tx) => {
      // Recheck and lock the chunk
      const chunk = await tx.audioChunk.findUnique({ where: { id: nextChunk.id } })
      if (!chunk || chunk.status !== 'AVAILABLE') throw new Error('Chunk no longer available')

      const created = await tx.chunkAssignment.create({
        data: {
          chunkId: chunk.id,
          userId: user.id,
          expiresAt,
        },
      })

      await tx.audioChunk.update({ where: { id: chunk.id }, data: { status: 'ASSIGNED' } })

      return created
    })

    const chunk = await prisma.audioChunk.findUnique({ where: { id: assignment.chunkId } })

    return NextResponse.json({ assignment: { id: assignment.id, expiresAt: assignment.expiresAt, chunk } }, { status: 201 })
  } catch (e: any) {
    console.error('transcriber/chunks/claim error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
