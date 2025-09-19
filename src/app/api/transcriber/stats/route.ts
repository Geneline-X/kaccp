import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

const RATE_PER_MIN_SLE = 1.2

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get all transcriptions by this user (ids + chunkId)
    const mySubs = await prisma.transcription.findMany({
      where: { userId: user.id },
      select: { id: true, chunkId: true, submittedAt: true },
    })

    const myTranscriptionIds = new Set(mySubs.map(s => s.id))
    const myChunkIds = Array.from(new Set(mySubs.map(s => s.chunkId)))

    // Load chunks for those chunkIds
    const chunks = await prisma.audioChunk.findMany({
      where: { id: { in: myChunkIds } },
      select: { id: true, durationSec: true, approvedTranscriptionId: true },
    })

    let submittedSeconds = 0
    let approvedSeconds = 0

    for (const ch of chunks) {
      const duration = ch.durationSec || 0
      // Submitted seconds: if the user has any submission for this chunk (avoid double counting)
      submittedSeconds += duration
      // Approved seconds: only if the approved transcription is one of user's submissions
      if (ch.approvedTranscriptionId && myTranscriptionIds.has(ch.approvedTranscriptionId)) {
        approvedSeconds += duration
      }
    }

    const submittedMinutes = submittedSeconds / 60
    const approvedMinutes = approvedSeconds / 60
    const earningsEstimateSLE = approvedMinutes * RATE_PER_MIN_SLE

    return NextResponse.json({
      submitted: {
        seconds: submittedSeconds,
        minutes: submittedMinutes,
        hours: submittedMinutes / 60,
      },
      approved: {
        seconds: approvedSeconds,
        minutes: approvedMinutes,
        hours: approvedMinutes / 60,
      },
      rate: { perMinuteSLE: RATE_PER_MIN_SLE },
      earnings: { estimatedSLE: earningsEstimateSLE },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
