import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { getAuthUser, hashPassword, verifyPassword } from '@/lib/infra/auth/auth'
import { z } from 'zod'

const UpdateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  // Change password flow
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6).optional(),
}).refine((data) => {
  // If either password field provided, both must be provided
  if ((data.currentPassword && !data.newPassword) || (!data.currentPassword && data.newPassword)) return false
  return true
}, { message: 'currentPassword and newPassword must both be provided to change password' })

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        qualityScore: true,
        totalEarningsCents: true,
      },
    })

    return NextResponse.json({ user: me })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = UpdateSchema.parse(await req.json())

    // Optional password change
    if (body.currentPassword && body.newPassword) {
      const ok = await verifyPassword(body.currentPassword, user.passwordHash)
      if (!ok) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })
      const newHash = await hashPassword(body.newPassword)
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
    }

    // Optional display name change
    if (typeof body.displayName === 'string') {
      await prisma.user.update({ where: { id: user.id }, data: { displayName: body.displayName } })
    }

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, displayName: true, role: true, isActive: true, lastLoginAt: true },
    })

    return NextResponse.json({ user: updated })
  } catch (e: any) {
    console.error('profile PATCH error', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
