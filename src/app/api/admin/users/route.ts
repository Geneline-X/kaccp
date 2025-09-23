import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, password, displayName, role } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const roleNorm = (role || 'TRANSCRIBER').toUpperCase()
    if (!['ADMIN', 'TRANSCRIBER'].includes(roleNorm)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'User already exists' }, { status: 409 })

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName || null,
        role: roleNorm as 'ADMIN' | 'TRANSCRIBER',
      },
      select: { id: true, email: true, displayName: true, role: true }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    console.error('Admin create user error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const withStats = searchParams.get('stats') === 'true'

    const baseUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        bio: true,
        country: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        qualityScore: true,
        totalEarningsCents: true,
      },
      take: 200,
    })

    if (!withStats) return NextResponse.json({ items: baseUsers })

    // compute audios uploaded and reviews performed counts per user
    const items = [] as any[]
    for (const u of baseUsers) {
      const [audios, reviews, approved, paid] = await Promise.all([
        prisma.audioSource.count({ where: { uploadedById: u.id } }),
        prisma.review.count({ where: { reviewerId: u.id } }),
        prisma.review.findMany({
          where: { decision: 'APPROVED' as any, transcription: { userId: u.id } },
          select: { transcription: { select: { chunk: { select: { durationSec: true } } } } },
        }),
        prisma.payment.aggregate({
          _sum: { amountCents: true },
          where: { userId: u.id, status: 'PAID' as any, currency: 'SLE' as any },
        }),
      ])
      const approvedSeconds = approved.reduce((acc, r) => acc + (r.transcription?.chunk?.durationSec || 0), 0)
      const approvedMinutes = approvedSeconds / 60
      const estimatedSLE = approvedMinutes * 1.2
      const paidSLE = ((paid?._sum?.amountCents || 0) / 100)
      const balanceSLE = Math.max(estimatedSLE - paidSLE, 0)
      items.push({ ...u, _count: { audios, reviews }, approvedMinutes, estimatedSLE, paidSLE, balanceSLE })
    }

    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
