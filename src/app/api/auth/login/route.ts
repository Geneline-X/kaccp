import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signJwt, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const emailOrPhone = body.emailOrPhone || body.email
    const password = body.password
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

    const payloadRole = user.role as 'ADMIN' | 'TRANSCRIBER'
    const token = signJwt({ sub: user.id, role: payloadRole })

    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      token,
    })
  } catch (e) {
    console.error('Login error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
