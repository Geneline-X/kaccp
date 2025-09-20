import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getSignedUrl } from '@/lib/gcs'

// GET /api/admin/approved?page=1&pageSize=25
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)
    const skip = (page - 1) * pageSize

    const where = { approvedTranscriptionId: { not: null } } as const

    const [total, items] = await Promise.all([
      prisma.audioChunk.count({ where }),
      prisma.audioChunk.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { index: 'asc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          sourceId: true,
          index: true,
          durationSec: true,
          storageUri: true,
          approvedTranscriptionId: true,
          approvedTranscription: {
            select: {
              id: true,
              text: true,
              aiSuggestedText: true,
              review: { select: { id: true, useAiSuggestion: true } },
              user: { select: { id: true, email: true, displayName: true } },
              submittedAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    const rows = await Promise.all(
      (items || []).map(async (c) => {
        const useAi = c.approvedTranscription?.review?.useAiSuggestion
        const finalText = useAi
          ? (c.approvedTranscription?.aiSuggestedText || c.approvedTranscription?.text || '')
          : (c.approvedTranscription?.text || '')
        const url = await getSignedUrl(c.storageUri).catch(() => null)
        return {
          chunk: {
            id: c.id,
            sourceId: c.sourceId,
            index: c.index,
            durationSec: c.durationSec,
            url,
          },
          transcription: {
            id: c.approvedTranscription?.id,
            text: finalText,
            submittedAt: c.approvedTranscription?.submittedAt || null,
            user: c.approvedTranscription?.user || null,
          },
        }
      })
    )

    return NextResponse.json({ items: rows, page, pageSize, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
