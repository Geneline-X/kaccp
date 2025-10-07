import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { chunkId } = await req.json()
    if (!chunkId) return NextResponse.json({ error: 'Missing chunkId' }, { status: 400 })

    // Check if chunk exists
    const chunk = await prisma.audioChunk.findUnique({ where: { id: chunkId } })
    if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })

    // Mark as reported broken
    await prisma.audioChunk.update({
      where: { id: chunkId },
      data: {
        reportedBroken: true,
        reportedBy: user.id,
        reportedAt: new Date(),
        status: 'FAILED', // Mark as failed so it doesn't appear in available
      },
    })

    // Release any active assignments for this chunk
    await prisma.chunkAssignment.updateMany({
      where: { chunkId, releasedAt: null },
      data: { releasedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('report-broken error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}