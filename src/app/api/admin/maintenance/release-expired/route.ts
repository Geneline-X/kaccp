import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const now = new Date()
    const expired = await prisma.chunkAssignment.findMany({
      where: {
        releasedAt: null,
        expiresAt: { lt: now },
      },
      select: { id: true, chunkId: true },
      take: 500,
    })

    if (expired.length === 0) return NextResponse.json({ released: 0 })

    const result = await prisma.$transaction(async (tx) => {
      // mark assignments released
      await tx.chunkAssignment.updateMany({
        where: { id: { in: expired.map((e) => e.id) } },
        data: { releasedAt: now },
      })
      // set chunks back to AVAILABLE if not approved yet
      await Promise.all(
        expired.map(async (e) => {
          const chunk = await tx.audioChunk.findUnique({ where: { id: e.chunkId } })
          if (chunk && !chunk.approvedTranscriptionId) {
            await tx.audioChunk.update({ where: { id: e.chunkId }, data: { status: 'AVAILABLE' } })
          }
        })
      )
      return expired.length
    })

    return NextResponse.json({ released: result })
  } catch (e: any) {
    console.error('admin/maintenance/release-expired error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
