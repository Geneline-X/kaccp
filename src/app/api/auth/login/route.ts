import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { signJwt, verifyPassword } from '@/lib/infra/auth/auth'
import { rateLimit, RATE_LIMITS } from '@/lib/infra/rate-limit'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMITS.auth);
  if (limited) return limited;
  try {
    const body = await req.json()
    const emailOrPhone = String(body.emailOrPhone || body.email || '').trim()
    const password = body.password
    const requestedRole = body.requestedRole // Optional: which role they want to login as

    if (!emailOrPhone || !password) {
      return NextResponse.json({ error: 'Email/Phone and password are required' }, { status: 400 })
    }

    // Case-insensitive because older accounts were stored as typed, and a few
    // emails exist twice differing only by case: pick the one the password fits.
    const candidates = emailOrPhone.includes('@')
      ? await prisma.user.findMany({ where: { email: { equals: emailOrPhone, mode: 'insensitive' }, isActive: true } })
      : await prisma.user.findMany({ where: { phone: emailOrPhone, isActive: true } })
    let user = null
    for (const c of candidates) {
      if (await verifyPassword(password, c.passwordHash)) {
        user = c
        break
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    // Determine which role to use
    let activeRole = user.role
    const userRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role]

    // If a specific role was requested, validate they have it
    if (requestedRole) {
      if (!userRoles.includes(requestedRole as any)) {
        return NextResponse.json({
          error: `You don't have access to login as ${requestedRole}. Your available roles: ${userRoles.join(', ')}`
        }, { status: 403 })
      }
      activeRole = requestedRole
    }

    // V2: Support all roles with active role in JWT
    const token = signJwt({ sub: user.id, role: activeRole, availableRoles: userRoles })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        role: activeRole, // Active role for this session
        roles: userRoles, // All available roles
        speaksLanguages: user.speaksLanguages,
        writesLanguages: user.writesLanguages,
      },
      token,
    })
  } catch (e) {
    console.error('Login error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
