import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { hashPassword, requireAdmin } from '@/lib/infra/auth/auth'
import { UserRole } from '@prisma/client'
import { isContributor, MIN_PASSWORD_LENGTH } from '@/lib/domain/users/onboarding'

const ALL_ROLES = ['ADMIN', 'TRANSCRIBER', 'SPEAKER', 'REVIEWER'] as const

/**
 * Admin-only account creation — the only way an account comes into existence.
 *
 * Body: { email, phone?, password, displayName?, roles: UserRole[] (first = primary),
 *         speaksLanguages?, writesLanguages?, ageVerified }
 *
 * The admin chooses the starting password; the account is created with
 * mustChangePassword = true so the person replaces it on first login.
 * Contributor accounts (SPEAKER / TRANSCRIBER) require ageVerified === true — the
 * admin's attestation that the person is 18+, recorded with who made it and when.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
    const password = typeof body.password === 'string' ? body.password : ''
    const displayName = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : null

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Accept `roles` (new form) or a single legacy `role`.
    const rawRoles: unknown[] = Array.isArray(body.roles) && body.roles.length > 0
      ? body.roles
      : [body.role || 'TRANSCRIBER']
    const roles = Array.from(new Set(rawRoles.map((r) => String(r).toUpperCase())))
    if (roles.length === 0 || !roles.every((r) => (ALL_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const toCodes = (v: unknown) =>
      Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && !!x))) : []
    const speaksLanguages = toCodes(body.speaksLanguages)
    const writesLanguages = toCodes(body.writesLanguages)

    const contributor = isContributor({ role: roles[0], roles })
    if (contributor && body.ageVerified !== true) {
      return NextResponse.json(
        { error: 'Confirm you have verified this person is 18 or older' },
        { status: 400 }
      )
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    if (phone) {
      const phoneTaken = await prisma.user.findFirst({ where: { phone } })
      if (phoneTaken) return NextResponse.json({ error: 'Phone already in use' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const now = new Date()
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        displayName,
        role: roles[0] as UserRole,
        roles: roles as UserRole[],
        speaksLanguages,
        writesLanguages,
        mustChangePassword: true,
        ...(contributor ? { ageVerifiedAt: now, ageVerifiedById: admin.id } : {}),
      },
      select: {
        id: true, email: true, phone: true, displayName: true, role: true, roles: true,
        speaksLanguages: true, writesLanguages: true,
      }
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
        roles: true,
        isActive: true,
        createdAt: true,
        ageVerifiedAt: true,
        termsAcceptedAt: true,
        mustChangePassword: true,
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
