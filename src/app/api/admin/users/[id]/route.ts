import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params

    const user = await (prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        qualityScore: true,
        totalEarningsCents: true,
        avatarUrl: true,
        country: true,
      } as any,
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Recent activity and aggregates
    const [reviewsCount, uploadsCount, recentReviews, recentPayments] = await Promise.all([
      prisma.review.count({ where: { reviewerId: id } }),
      prisma.audioSource.count({ where: { uploadedById: id } }),
      prisma.review.findMany({ where: { reviewerId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, decision: true, createdAt: true, transcriptionId: true } }),
      prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amountCents: true, currency: true, status: true, createdAt: true } }),
    ])

    // Approved minutes (all-time) for leaderboard consistency
    const approvedReviews = await prisma.review.findMany({
      where: { decision: 'APPROVED' as any, transcription: { userId: id } },
      select: { transcription: { select: { chunk: { select: { durationSec: true } } } } },
    })
    const approvedMinutes = approvedReviews.reduce((acc, r) => acc + ((r.transcription?.chunk?.durationSec || 0) / 60), 0)

    // Submission status breakdown for datasets state
    const submissions = await prisma.transcription.findMany({
      where: { userId: id },
      select: { id: true, submittedAt: true, review: { select: { decision: true } } },
      take: 200,
      orderBy: { createdAt: 'desc' },
    })
    const statusCounts = submissions.reduce((m: Record<string, number>, s) => {
      const key = s.review?.decision || (s.submittedAt ? 'SUBMITTED' : 'DRAFT')
      m[key] = (m[key] || 0) + 1
      return m
    }, {})

    return NextResponse.json({
      user,
      stats: {
        reviewsCount,
        uploadsCount,
        approvedMinutes,
        statusCounts,
      },
      recent: {
        reviews: recentReviews,
        payments: recentPayments,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
