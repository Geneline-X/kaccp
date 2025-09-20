import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// GET /api/transcriber/submissions?status=PENDING|APPROVED|REJECTED|EDIT_REQUESTED|ALL&page=1&pageSize=25
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = (searchParams.get('status') || 'PENDING').toUpperCase()
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)
    const skip = (page - 1) * pageSize

    // Build where clause: transcriptions by current user that were submitted
    // Status mapping: if review is null => PENDING. Else decision.
    // We'll filter by existence of review depending on status requested.

    let where: any = { userId: me.id, submittedAt: { not: null } }

    if (status !== 'ALL') {
      if (status === 'PENDING') {
        where = { ...where, review: null }
      } else if (['APPROVED', 'REJECTED', 'EDIT_REQUESTED'].includes(status)) {
        where = { ...where, review: { decision: status } }
      }
    }

    const [total, items] = await Promise.all([
      prisma.transcription.count({ where }),
      prisma.transcription.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          submittedAt: true,
          text: true,
          aiSuggestedText: true,
          assignmentId: true,
          chunkId: true,
          review: { select: { id: true, decision: true, comments: true } },
          chunk: { select: { id: true, index: true, durationSec: true, sourceId: true, status: true } }
        }
      })
    ])

    // Normalize status field on each item
    const normalized = items.map((t) => ({
      ...t,
      status: t.review?.decision ?? 'PENDING',
    }))

    return NextResponse.json({ items: normalized, page, pageSize, total })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
