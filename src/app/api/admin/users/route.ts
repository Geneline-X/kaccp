import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, requireAdmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { email, phone, password, displayName, role } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const roleNorm = (role || 'TRANSCRIBER').toUpperCase()
    if (!['ADMIN', 'TRANSCRIBER', 'SPEAKER'].includes(roleNorm)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'User already exists' }, { status: 409 })

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        passwordHash,
        displayName: displayName || null,
        role: roleNorm as 'ADMIN' | 'TRANSCRIBER' | 'SPEAKER',
      },
      select: { id: true, email: true, phone: true, displayName: true, role: true }
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
    const roleFilter = searchParams.get('role')

    // V2 Schema - updated fields
    const baseUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      where: roleFilter ? { role: roleFilter as any } : undefined,
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        qualityScore: true,
        totalEarningsCents: true,
        speaksLanguages: true,
        writesLanguages: true,
        totalRecordingsSec: true,
        totalTranscriptions: true,
      },
      take: 200,
    })

    if (!withStats) return NextResponse.json({ items: baseUsers })

    // V2: Compute stats from recordings and transcriptions
    const items = [] as any[]
    for (const u of baseUsers) {
      const [recordingsCount, transcriptionsCount, approvedRecordings, approvedTranscriptions] = await Promise.all([
        prisma.recording.count({ where: { speakerId: u.id } }),
        prisma.transcription.count({ where: { transcriberId: u.id } }),
        prisma.recording.aggregate({
          _sum: { durationSec: true },
          where: { speakerId: u.id, status: 'APPROVED' },
        }),
        prisma.transcription.count({
          where: { transcriberId: u.id, status: 'APPROVED' },
        }),
      ])
      
      const approvedRecordingSec = approvedRecordings._sum?.durationSec || 0
      const approvedRecordingMin = approvedRecordingSec / 60
      
      items.push({
        ...u,
        _count: {
          recordings: recordingsCount,
          transcriptions: transcriptionsCount,
        },
        approvedRecordingMin,
        approvedTranscriptions,
      })
    }

    return NextResponse.json({ items })
  } catch (e) {
    console.error('Admin users error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
