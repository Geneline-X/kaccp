import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'
import { creditUserForApproval } from '@/lib/payments'

const ReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'EDIT_REQUESTED']),
  comments: z.string().optional(),
  useAiSuggestion: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params // transcriptionId
    const { decision, comments, useAiSuggestion } = ReviewSchema.parse(await req.json())

    const result = await prisma.$transaction(async (tx) => {
      const sub = await tx.transcription.findUnique({
        where: { id },
        include: { chunk: true, user: true },
      })
      if (!sub) throw new Error('Transcription not found')

      if (await tx.review.findUnique({ where: { transcriptionId: id } })) {
        throw new Error('Already reviewed')
      }

      // Create review
      const review = await tx.review.create({
        data: {
          transcriptionId: id,
          reviewerId: admin.id,
          decision,
          comments: comments ?? null,
          useAiSuggestion: Boolean(useAiSuggestion),
          approvedDurationSec: decision === 'APPROVED' ? sub.chunk.durationSec : null,
        },
      })

      if (decision === 'APPROVED') {
        // Check if another transcription already approved for this chunk
        const chunk = await tx.audioChunk.findUnique({ where: { id: sub.chunkId } })
        if (!chunk) throw new Error('Chunk not found')
        if (chunk.approvedTranscriptionId && chunk.approvedTranscriptionId !== sub.id) {
          throw new Error('Chunk already has an approved transcription')
        }

        await tx.audioChunk.update({
          where: { id: sub.chunkId },
          data: {
            status: 'APPROVED',
            approvedTranscriptionId: sub.id,
          },
        })

        // Credit the transcriber
        await creditUserForApproval(tx as any, {
          userId: sub.userId,
          chunkId: sub.chunkId,
          durationSec: sub.chunk.durationSec,
        })
      } else if (decision === 'REJECTED') {
        await tx.audioChunk.update({ where: { id: sub.chunkId }, data: { status: 'REJECTED' } })
      } else if (decision === 'EDIT_REQUESTED') {
        await tx.audioChunk.update({ where: { id: sub.chunkId }, data: { status: 'UNDER_REVIEW' } })
      }

      return { reviewId: review.id }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('admin/reviews/[id] error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
