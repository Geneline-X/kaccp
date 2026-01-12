import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signJwt, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const emailOrPhone = body.emailOrPhone || body.email
    const password = body.password
    const requestedRole = body.requestedRole // Optional: which role they want to login as

    if (!emailOrPhone || !password) {
      return NextResponse.json({ error: 'Email/Phone and password are required' }, { status: 400 })
    }

    const user = emailOrPhone.includes('@')
      ? await prisma.user.findUnique({ where: { email: emailOrPhone } })
      : await prisma.user.findFirst({ where: { phone: emailOrPhone } })
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
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
