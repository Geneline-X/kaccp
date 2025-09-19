import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const RATE_PER_MIN_SLE = 1.2
const CASHOUT_THRESHOLD_SLE = 30

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '25', 10) || 25, 1), 100)
    const skip = (page - 1) * pageSize

    const weekCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Fetch APPROVED reviews in the last 7 days
    const reviews = await (prisma as any).review.findMany({
      where: { decision: 'APPROVED', createdAt: { gte: weekCutoff } },
      include: {
        transcription: {
          select: {
            userId: true,
            user: { select: { displayName: true, email: true, country: true, avatarUrl: true } },
            chunk: { select: { durationSec: true } },
          },
        },
      },
    })

    const perUser: Record<string, { minutes: number; email?: string | null; displayName?: string | null; country?: string | null; avatarUrl?: string | null }> = {}
    for (const r of reviews as any[]) {
      const t = r.transcription
      const uid = t?.userId
      const dur = t?.chunk?.durationSec || 0
      if (!uid) continue
      if (!perUser[uid]) {
        perUser[uid] = {
          minutes: 0,
          email: (t as any)?.user?.email || null,
          displayName: (t as any)?.user?.displayName || null,
          country: (t as any)?.user?.country || null,
          avatarUrl: (t as any)?.user?.avatarUrl || null,
        }
      }
      perUser[uid].minutes += dur / 60
    }

    const users = Object.entries(perUser).map(([userId, info]) => {
      const estimatedSLE = info.minutes * RATE_PER_MIN_SLE
      return {
        userId,
        email: info.email,
        displayName: info.displayName,
        country: info.country,
        avatarUrl: info.avatarUrl,
        weeklyApprovedMinutes: info.minutes,
        weeklyEstimatedSLE: estimatedSLE,
        eligible: estimatedSLE >= CASHOUT_THRESHOLD_SLE,
      }
    }).sort((a, b) => b.weeklyEstimatedSLE - a.weeklyEstimatedSLE)

    const total = users.length
    const pageItems = users.slice(skip, skip + pageSize)

    return NextResponse.json({
      items: pageItems,
      total,
      page,
      pageSize,
      ratePerMinuteSLE: RATE_PER_MIN_SLE,
      thresholdSLE: CASHOUT_THRESHOLD_SLE,
      cutoffIso: weekCutoff.toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
