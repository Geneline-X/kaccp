import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, signJwt } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, phone, password, displayName } = await req.json()
    if (!email || !phone || !password) {
      return NextResponse.json({ error: 'Email, phone and password are required' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    const existingPhone = await prisma.user.findFirst({ where: { phone } })
    if (existingPhone) {
      return NextResponse.json({ error: 'Phone already in use' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        displayName: displayName || null,
        role: 'TRANSCRIBER',
      },
      select: { id: true, email: true, phone: true, displayName: true, role: true }
    })

    const token = signJwt({ sub: user.id, role: user.role as 'ADMIN' | 'TRANSCRIBER' })

    return NextResponse.json({ user, token }, { status: 201 })
  } catch (e) {
    console.error('Register error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
