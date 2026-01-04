import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const enriched = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        role: true,
        qualityScore: true,
        totalEarningsCents: true,
        // V2 fields
        speaksLanguages: true,
        writesLanguages: true,
        totalRecordingsSec: true,
        totalTranscriptions: true,
        createdAt: true,
        lastLoginAt: true,
      },
    })

    return NextResponse.json({ user: enriched })
  } catch (e) {
    console.error('Me error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
