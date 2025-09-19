import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function parseRange(range?: string) {
  const now = new Date()
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (range === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return null // all-time
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || 'all'
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)
    const skip = (page - 1) * pageSize

    const cutoff = parseRange(range)

    // Reviews are the source of truth for APPROVED
    const reviews = await prisma.review.findMany({
      where: cutoff ? { createdAt: { gte: cutoff }, decision: 'APPROVED' as any } : { decision: 'APPROVED' as any },
      select: {
        createdAt: true,
        transcription: { select: { userId: true, chunk: { select: { durationSec: true } } } },
      },
    })

    // Aggregate per user
    const perUser: Record<string, { minutes: number }> = {}
    for (const r of reviews) {
      const uid = r.transcription?.userId
      const dur = r.transcription?.chunk?.durationSec || 0
      if (!uid) continue
      perUser[uid] = perUser[uid] || { minutes: 0 }
      perUser[uid].minutes += dur / 60
    }

    const RATE = 1.2

    // Load users for display and filter by opt-in
    const userIds = Object.keys(perUser)
    const users = await (prisma as any).user.findMany({
      where: { id: { in: userIds }, showOnLeaderboard: true, role: 'TRANSCRIBER' },
      select: { id: true, displayName: true, email: true, country: true, avatarUrl: true } as any,
    })

    const items = users
      .map((u: any) => {
        const fallbackAnon = `Transcriber ${u.id.slice(0,4)}…`
        const name = u.displayName?.trim() || fallbackAnon
        return {
          userId: u.id,
          name,
          country: u.country || null,
          avatarUrl: u.avatarUrl || null,
          approvedMinutes: perUser[u.id]?.minutes || 0,
          estimatedSLE: (perUser[u.id]?.minutes || 0) * RATE,
        }
      })
      .sort((a: any, b: any) => b.approvedMinutes - a.approvedMinutes)

    const total = items.length
    const pageItems = items.slice(skip, skip + pageSize)

    return NextResponse.json({ items: pageItems, total, page, pageSize, ratePerMinuteSLE: RATE })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
