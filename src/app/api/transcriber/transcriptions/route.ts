import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { improveEnglish } from '@/lib/ai'
import { getAuthUser } from '@/lib/auth'

const SubmitSchema = z.object({
  assignmentId: z.string(),
  text: z.string().min(1),
  language: z.string().default('en'),
  guidanceScore: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId, text, language, guidanceScore, notes } = SubmitSchema.parse(await req.json())

    const assignment = await prisma.chunkAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment || assignment.userId !== user.id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Expiry check
    if (assignment.expiresAt && assignment.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Assignment expired, please claim again' }, { status: 410 })
    }

    // Call AI to improve English structure (best-effort; fallback to original on error)
    let aiSuggestedText: string | null = null
    let aiModel: string | null = null
    let aiScore: number | null = null
    try {
      const ai = await improveEnglish(text)
      aiSuggestedText = ai.corrected
      aiModel = ai.model
      aiScore = ai.score
    } catch (e) {
      console.warn('AI correction failed, proceeding without suggestion')
    }

    const submission = await prisma.$transaction(async (tx) => {
      const created = await tx.transcription.create({
        data: {
          assignmentId: assignment.id,
          chunkId: assignment.chunkId,
          userId: user.id,
          text,
          language,
          guidanceScore: guidanceScore ?? null,
          notes: notes ?? null,
          submittedAt: new Date(),
          aiSuggestedText,
          aiModel,
          aiScore,
        },
      })

      // Mark chunk as submitted and release the assignment so it drops from 'My Work'
      await tx.audioChunk.update({ where: { id: assignment.chunkId }, data: { status: 'SUBMITTED' } })
      await tx.chunkAssignment.update({ where: { id: assignment.id }, data: { releasedAt: new Date() } })

      return created
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (e: any) {
    console.error('transcriber/transcriptions submit error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
