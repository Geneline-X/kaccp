import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

// Update chunk processing status after worker operations
// Example payloads:
// { updates: [ { chunkId, status: 'PROCESSING'|'READY'|'FAILED', statusMessage? } ] }
// Note: 'READY' will be mapped to ChunkStatus.AVAILABLE for assignment.

const UpdateSchema = z.object({
  updates: z.array(z.object({
    chunkId: z.string(),
    status: z.enum(['PROCESSING', 'READY', 'FAILED']),
    statusMessage: z.string().optional(),
  })).min(1)
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { updates } = UpdateSchema.parse(json)

    await prisma.$transaction(
      updates.map((u) => prisma.audioChunk.update({
        where: { id: u.chunkId },
        data: {
          status: u.status === 'READY' ? 'AVAILABLE' : (u.status as any),
        },
      }))
    )

    return NextResponse.json({ ok: true, count: updates.length })
  } catch (e: any) {
    console.error('worker/chunks/status error', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
