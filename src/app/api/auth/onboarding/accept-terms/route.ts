import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { getAuthUser, invalidateAuthUser } from '@/lib/infra/auth/auth'
import { TERMS_VERSION, isContributor } from '@/lib/domain/users/onboarding'

/**
 * First-login step 2 (contributors): accept the current Terms of Service and
 * Privacy Policy. Records when, and which version, so a later Terms change can
 * ask everyone to accept again by bumping TERMS_VERSION.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (user.mustChangePassword) {
      return NextResponse.json({ error: 'Change your password first' }, { status: 409 })
    }
    if (!isContributor(user)) {
      return NextResponse.json({ error: 'Terms acceptance is only required for contributors' }, { status: 400 })
    }

    const { accepted, version } = await req.json().catch(() => ({}))
    if (accepted !== true) {
      return NextResponse.json(
        { error: 'You must accept the Terms of Service and Privacy Policy' },
        { status: 400 }
      )
    }
    // The page must have shown the version currently in force, not a stale one.
    if (version !== TERMS_VERSION) {
      return NextResponse.json(
        { error: 'The Terms have changed. Please reload and review them again.', version: TERMS_VERSION },
        { status: 409 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
    })
    invalidateAuthUser(user.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Onboarding accept-terms error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
