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
