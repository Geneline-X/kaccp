import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const RegisterSchema = z.object({
  sourceId: z.string(),
  chunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      startSec: z.number().int().nonnegative(),
      endSec: z.number().int().nonnegative(),
      durationSec: z.number().int().positive(),
      storageUri: z.string().min(1),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { sourceId, chunks } = RegisterSchema.parse(json)

    const source = await prisma.audioSource.findUnique({ where: { id: sourceId } })
    if (!source) {
      return NextResponse.json({ error: 'AudioSource not found' }, { status: 404 })
    }

    // Upsert chunks in a transaction to avoid duplicates
    await prisma.$transaction(
      chunks.map((c) =>
        prisma.audioChunk.upsert({
          where: { sourceId_index: { sourceId, index: c.index } },
          create: {
            sourceId,
            index: c.index,
            startSec: c.startSec,
            endSec: c.endSec,
            durationSec: c.durationSec,
            storageUri: c.storageUri,
            status: 'AVAILABLE',
          },
          update: {
            startSec: c.startSec,
            endSec: c.endSec,
            durationSec: c.durationSec,
            storageUri: c.storageUri,
          },
        })
      )
    )

    return NextResponse.json({ ok: true, count: chunks.length })
  } catch (e: any) {
    console.error('worker/chunks/register error', e)
    const msg = e?.message || 'Invalid request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
