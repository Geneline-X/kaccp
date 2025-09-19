import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const ReleaseSchema = z.object({
  assignmentId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId } = ReleaseSchema.parse(await req.json())

    const assignment = await prisma.chunkAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment || assignment.userId !== user.id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    if (assignment.releasedAt) {
      return NextResponse.json({ ok: true, alreadyReleased: true })
    }

    await prisma.$transaction(async (tx) => {
      await tx.chunkAssignment.update({ where: { id: assignment.id }, data: { releasedAt: new Date() } })

      // If the chunk has no approved transcription, set it back to AVAILABLE
      const chunk = await tx.audioChunk.findUnique({ where: { id: assignment.chunkId } })
      if (chunk && !chunk.approvedTranscriptionId) {
        await tx.audioChunk.update({ where: { id: chunk.id }, data: { status: 'AVAILABLE' } })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('transcriber/chunks/release error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
