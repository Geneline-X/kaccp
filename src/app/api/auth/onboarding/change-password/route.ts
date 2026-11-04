import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { getAuthUser, hashPassword, verifyPassword, invalidateAuthUser } from '@/lib/infra/auth/auth'
import { rateLimit, RATE_LIMITS } from '@/lib/infra/rate-limit'
import { MIN_PASSWORD_LENGTH } from '@/lib/domain/users/onboarding'

/**
 * First-login step 1: replace the starting password an admin chose.
 * Requires the current (admin-set) password so a borrowed, unlocked session
 * cannot silently take over the account.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMITS.auth)
  if (limited) return limited
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json().catch(() => ({}))
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      return NextResponse.json(
        { error: 'New password must be different from the one you were given' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    })
    invalidateAuthUser(user.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Onboarding change-password error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
