import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { z } from 'zod'

const UpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  country: z.string().trim().max(64).optional(),
  showOnLeaderboard: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await (prisma as any).user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        bio: true,
        country: true,
        avatarUrl: true,
        showOnLeaderboard: true,
      } as any,
    })
    return NextResponse.json({ user: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const data = UpdateSchema.parse(body)

    const updated = await (prisma as any).user.update({
      where: { id: user.id },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.showOnLeaderboard !== undefined ? { showOnLeaderboard: data.showOnLeaderboard } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      } as any,
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: updated.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
