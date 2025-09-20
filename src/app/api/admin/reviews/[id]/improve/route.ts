import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { improveEnglish } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params // transcriptionId
    const body = await req.json().catch(() => ({})) as { text?: string }

    // Load current text if not provided
    let text = body.text
    if (!text) {
      const t = await prisma.transcription.findUnique({ where: { id }, select: { text: true } })
      if (!t) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 })
      text = t.text
    }

    const result = await improveEnglish(text!)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('admin/reviews/[id]/improve error', e)
    const msg = e?.message || 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
