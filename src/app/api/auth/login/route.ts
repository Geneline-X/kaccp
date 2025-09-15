import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { signJwt, verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { email } })
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
