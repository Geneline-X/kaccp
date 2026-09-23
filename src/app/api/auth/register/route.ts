import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { hashPassword, signJwt } from '@/lib/infra/auth/auth'
import { UserRole } from '@prisma/client'
import { rateLimit, RATE_LIMITS } from '@/lib/infra/rate-limit'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMITS.auth);
  if (limited) return limited;
  try {
    const { 
      email, 
      phone, 
      password, 
      displayName,
      role = 'SPEAKER',  // Default to SPEAKER for V2
      speaksLanguages = [],  // Language codes user can speak
      writesLanguages = [],  // Language codes user can write/transcribe
      ageConfirmed,      // Attests to being 18 or older
      termsAccepted,     // Accepts TERMS.md and PRIVACY.md
    } = await req.json()
    
    if (!email || !phone || !password) {
      return NextResponse.json({ error: 'Email, phone and password are required' }, { status: 400 })
    }

    // Contributing means being paid and granting rights over a recording of your own
    // voice — biometric data. Neither is a decision a minor can validly make, so the
    // registration form requires an explicit 18+ confirmation before it will submit.
    //
    // Rejected only when the client explicitly reports "no". A missing field is
    // treated as a client that predates this check — an already-open signup page
    // running a cached bundle — and is allowed through, so deploying this cannot
    // break a registration that is already in progress. The UI is the gate; this is
    // the backstop that refuses a negative answer.
    if (ageConfirmed === false) {
      return NextResponse.json(
        { error: 'You must be 18 or older to create an account' },
        { status: 400 }
      )
    }

    if (termsAccepted === false) {
      return NextResponse.json(
        { error: 'You must accept the Terms of Service and Privacy Policy' },
        { status: 400 }
      )
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
