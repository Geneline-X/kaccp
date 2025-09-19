import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const assignmentId = searchParams.get('assignmentId') || undefined
    const chunkId = searchParams.get('chunkId') || undefined

    if (!assignmentId && !chunkId) {
      return NextResponse.json({ error: 'assignmentId or chunkId is required' }, { status: 400 })
    }

    const draft = await prisma.transcription.findFirst({
      where: {
        userId: user.id,
        submittedAt: null,
        ...(assignmentId ? { assignmentId } : {}),
        ...(chunkId ? { chunkId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ draft })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
