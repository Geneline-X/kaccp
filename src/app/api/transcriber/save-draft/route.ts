import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const DraftSchema = z.object({
  assignmentId: z.string(),
  text: z.string().min(1),
  language: z.string().default('en').optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId, text, language, notes } = DraftSchema.parse(await req.json())

    const assignment = await prisma.chunkAssignment.findUnique({ where: { id: assignmentId } })
    if (!assignment || assignment.userId !== user.id) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Find latest non-submitted transcription for this assignment (draft)
    const latest = await prisma.transcription.findFirst({
      where: { assignmentId: assignment.id, userId: user.id, submittedAt: null },
      orderBy: { createdAt: 'desc' },
    })

    let draft
    if (latest) {
      draft = await prisma.transcription.update({
        where: { id: latest.id },
        data: { text, language: language || latest.language, notes: notes ?? latest.notes },
      })
    } else {
      draft = await prisma.transcription.create({
        data: {
          assignmentId: assignment.id,
          chunkId: assignment.chunkId,
          userId: user.id,
          text,
          language: language || 'en',
          notes: notes ?? null,
        },
      })
    }

    return NextResponse.json({ draft })
  } catch (e: any) {
    console.error('save-draft error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
