import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const ReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'EDIT_REQUESTED']),
  comments: z.string().optional(),
  useAiSuggestion: z.boolean().optional().default(false),
  editedText: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params // transcriptionId
    const { decision, comments, useAiSuggestion, editedText } = ReviewSchema.parse(await req.json())

    // Load submission with related chunk and user
    const sub = await prisma.transcription.findUnique({
      where: { id },
      include: { chunk: true, user: true },
    })
    if (!sub) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 })

    // If already reviewed (unique on transcriptionId), bail
    const existing = await prisma.review.findUnique({ where: { transcriptionId: id } })
    if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 400 })

    // If editor provided updated text, persist it before status changes
    if (decision === 'APPROVED' && typeof editedText === 'string' && editedText.trim().length > 0) {
      await prisma.transcription.update({ where: { id }, data: { text: editedText.trim() } })
    }

    // For APPROVED, first attempt to set the chunk approved optimistically
    if (decision === 'APPROVED') {
      const updated = await prisma.audioChunk.updateMany({
        where: {
          id: sub.chunkId,
          OR: [
            { approvedTranscriptionId: null },
            { approvedTranscriptionId: sub.id },
          ],
        },
        data: { status: 'APPROVED', approvedTranscriptionId: sub.id },
      })
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Chunk already has an approved transcription' }, { status: 409 })
      }
    } else if (decision === 'REJECTED') {
      await prisma.audioChunk.update({ where: { id: sub.chunkId }, data: { status: 'REJECTED' } })
    } else if (decision === 'EDIT_REQUESTED') {
      await prisma.audioChunk.update({ where: { id: sub.chunkId }, data: { status: 'UNDER_REVIEW' } })
    }

    // Create review (unique on transcriptionId enforces idempotence)
    const review = await prisma.review.create({
      data: {
        transcriptionId: id,
        reviewerId: admin.id,
        decision,
        comments: comments ?? null,
        useAiSuggestion: Boolean(useAiSuggestion),
        approvedDurationSec: decision === 'APPROVED' ? sub.chunk.durationSec : null,
      },
    })

    // Notify the transcriber about the decision
    const title =
      decision === 'APPROVED'
        ? 'Submission approved'
        : decision === 'REJECTED'
        ? 'Submission rejected'
        : 'Edits requested'
    const body = comments ? comments : null
    await prisma.notification.create({
      data: {
        userId: sub.userId,
        type: 'REVIEW',
        title,
        body,
        transcriptionId: id,
      },
    })

    return NextResponse.json({ ok: true, reviewId: review.id })
  } catch (e: any) {
    console.error('admin/reviews/[id] error', e)
    const msg = e?.message || 'Internal Server Error'
    // If unique constraint on review, surface friendly error
    if (msg.includes('Unique') || msg.toLowerCase().includes('already')) {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
