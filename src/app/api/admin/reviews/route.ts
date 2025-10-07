import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getSignedUrl } from '@/lib/gcs'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Pending = transcriptions without a review yet
    const pending = await prisma.transcription.findMany({
      where: {
        review: null,
        // Do not show any submission whose chunk is already approved
        chunk: { approvedTranscriptionId: null },
      },
      orderBy: { submittedAt: 'asc' },
      take: 500,
      distinct: ['chunkId'], // show only the oldest pending per chunk to avoid duplicates
      select: {
        id: true,
        submittedAt: true,
        text: true,
        language: true,
        guidanceScore: true,
        notes: true,
        aiSuggestedText: true,
        user: { 
          select: { 
            id: true, 
            email: true, 
            displayName: true,
            qualityScore: true,
            totalEarningsCents: true,
            country: true,
            lastLoginAt: true,
            createdAt: true,
            role: true,
          } 
        },
        chunk: { select: { id: true, sourceId: true, index: true, durationSec: true, storageUri: true, status: true } },
        assignment: { select: { id: true } },
      }
    })

    // Attach best-effort signed URL for audio playback
    const items = await Promise.all(pending.map(async (t) => {
      let url: string | null = null
      try { url = await getSignedUrl(t.chunk.storageUri) } catch {}
      return { ...t, chunk: { ...t.chunk, url } }
    }))

    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('admin/reviews list error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
