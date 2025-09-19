import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const items = await prisma.transcription.findMany({
      where: { userId: user.id, submittedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        assignmentId: true,
        chunkId: true,
        text: true,
        updatedAt: true,
        createdAt: true,
        chunk: { select: { id: true, index: true, durationSec: true, sourceId: true } },
      }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
