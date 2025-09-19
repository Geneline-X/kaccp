import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [chunks, approvedCount, assignedCount, submittedCount] = await Promise.all([
      prisma.audioChunk.findMany({ select: { durationSec: true, approvedTranscriptionId: true, status: true } }),
      prisma.audioChunk.count({ where: { approvedTranscriptionId: { not: null } } }),
      prisma.audioChunk.count({ where: { status: { in: ['ASSIGNED', 'UNDER_REVIEW'] as any } } }),
      prisma.audioChunk.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as any } } }),
    ])

    const totalSec = chunks.reduce((s, c) => s + (c.durationSec || 0), 0)
    const approvedSec = chunks.filter(c => c.approvedTranscriptionId).reduce((s, c) => s + (c.durationSec || 0), 0)
    const assignedSec = chunks.filter(c => ['ASSIGNED', 'UNDER_REVIEW'].includes((c.status as any) || '')).reduce((s, c) => s + (c.durationSec || 0), 0)
    const submittedSec = chunks.filter(c => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes((c.status as any) || '')).reduce((s, c) => s + (c.durationSec || 0), 0)

    return NextResponse.json({
      totals: {
        totalSeconds: totalSec,
        totalMinutes: totalSec / 60,
        totalHours: totalSec / 3600,
      },
      approved: {
        count: approvedCount,
        seconds: approvedSec,
        minutes: approvedSec / 60,
        hours: approvedSec / 3600,
      },
      assigned: {
        count: assignedCount,
        seconds: assignedSec,
        minutes: assignedSec / 60,
        hours: assignedSec / 3600,
      },
      submitted: {
        count: submittedCount,
        seconds: submittedSec,
        minutes: submittedSec / 60,
        hours: submittedSec / 3600,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
