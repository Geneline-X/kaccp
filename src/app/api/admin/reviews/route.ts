import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Pending = transcriptions without a review yet
    const pending = await prisma.transcription.findMany({
      where: { review: null },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        submittedAt: true,
        text: true,
        language: true,
        guidanceScore: true,
        notes: true,
        aiSuggestedText: true,
        user: { select: { id: true, email: true, displayName: true } },
        chunk: { select: { id: true, sourceId: true, index: true, durationSec: true, storageUri: true, status: true } },
        assignment: { select: { id: true } },
      }
    })

    return NextResponse.json({ items: pending })
  } catch (e: any) {
    console.error('admin/reviews list error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
