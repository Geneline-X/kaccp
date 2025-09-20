import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// POST /api/admin/approved/[id]/revert
// Revert an approved chunk back to SUBMITTED state for re-review
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params

    // Load chunk and its approved transcription
    const chunk = await prisma.audioChunk.findUnique({
      where: { id },
      select: { id: true, approvedTranscriptionId: true },
    })
    if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })
    if (!chunk.approvedTranscriptionId) return NextResponse.json({ error: 'Chunk is not approved' }, { status: 400 })

    await prisma.$transaction(async (tx) => {
      // Delete the review so the transcription becomes pending again
      await tx.review.deleteMany({ where: { transcriptionId: chunk.approvedTranscriptionId! } })
      // Clear approved pointer and set chunk back to SUBMITTED
      await tx.audioChunk.update({ where: { id: chunk.id }, data: { approvedTranscriptionId: null, status: 'SUBMITTED' } })
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
