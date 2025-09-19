import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const submissions = await prisma.transcription.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        submittedAt: true,
        text: true,
        language: true,
        guidanceScore: true,
        review: true,
        chunk: { select: { id: true, sourceId: true, index: true, durationSec: true, status: true } },
      },
    })

    return NextResponse.json({ items: submissions })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
