import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

// POST /api/admin/maintenance/sanitize-chunks
// Ensures chunk.status is consistent with submissions, approvals, and assignments
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let fixedApproved = 0
    let fixedSubmitted = 0
    let fixedAssigned = 0
    let fixedAvailable = 0

    await prisma.$transaction(async (tx) => {
      // 1) Ensure approved chunks are marked APPROVED
      const approvedWrong = await tx.audioChunk.findMany({
        where: { approvedTranscriptionId: { not: null }, NOT: { status: 'APPROVED' as any } },
        select: { id: true },
      })
      if (approvedWrong.length) {
        await tx.audioChunk.updateMany({
          where: { id: { in: approvedWrong.map(c => c.id) } },
          data: { status: 'APPROVED' as any },
        })
        fixedApproved = approvedWrong.length
      }

      // 2) Chunks with a pending submission should be SUBMITTED (and not APPROVED)
      const pendingSubs = await tx.audioChunk.findMany({
        where: {
          approvedTranscriptionId: null,
          transcriptions: { some: { submittedAt: { not: null }, review: null } },
          NOT: { status: 'SUBMITTED' as any },
        },
        select: { id: true },
      })
      if (pendingSubs.length) {
        await tx.audioChunk.updateMany({
          where: { id: { in: pendingSubs.map(c => c.id) } },
          data: { status: 'SUBMITTED' as any },
        })
        fixedSubmitted = pendingSubs.length
      }

      // 3) Chunks with an active assignment should be ASSIGNED (and not AVAILABLE)
      const now = new Date()
      const assigned = await tx.audioChunk.findMany({
        where: {
          approvedTranscriptionId: null,
          assignments: {
            some: {
              releasedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          },
          NOT: { status: 'ASSIGNED' as any },
        },
        select: { id: true },
      })
      if (assigned.length) {
        await tx.audioChunk.updateMany({
          where: { id: { in: assigned.map(c => c.id) } },
          data: { status: 'ASSIGNED' as any },
        })
        fixedAssigned = assigned.length
      }

      // 4) Everything else without approval, without pending, without active assignment should be AVAILABLE
      const candidates = await tx.audioChunk.findMany({
        where: {
          approvedTranscriptionId: null,
          transcriptions: { none: { submittedAt: { not: null }, review: null } },
          assignments: {
            none: { releasedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          },
          NOT: { status: 'AVAILABLE' as any },
        },
        select: { id: true },
      })
      if (candidates.length) {
        await tx.audioChunk.updateMany({
          where: { id: { in: candidates.map(c => c.id) } },
          data: { status: 'AVAILABLE' as any },
        })
        fixedAvailable = candidates.length
      }
    })

    return NextResponse.json({ ok: true, fixed: { approved: fixedApproved, submitted: fixedSubmitted, assigned: fixedAssigned, available: fixedAvailable } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
