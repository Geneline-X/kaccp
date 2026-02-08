import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { hashPassword, signJwt } from '@/lib/infra/auth/auth'
import { UserRole } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      phone, 
      password, 
      displayName,
      role = 'SPEAKER',  // Default to SPEAKER for V2
      speaksLanguages = [],  // Language codes user can speak
      writesLanguages = [],  // Language codes user can write/transcribe
    } = await req.json()
    
    if (!email || !phone || !password) {
      return NextResponse.json({ error: 'Email, phone and password are required' }, { status: 400 })
    }

    // Validate role
    const validRoles: UserRole[] = ['SPEAKER', 'TRANSCRIBER']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be SPEAKER or TRANSCRIBER' }, { status: 400 })
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
        role,
        speaksLanguages,
        writesLanguages,
      },
      select: { 
        id: true, 
        email: true, 
        phone: true, 
        displayName: true, 
        role: true,
        speaksLanguages: true,
        writesLanguages: true,
      }
    })

    const token = signJwt({ sub: user.id, role: user.role })

    return NextResponse.json({ user, token }, { status: 201 })
  } catch (e) {
    console.error('Register error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
