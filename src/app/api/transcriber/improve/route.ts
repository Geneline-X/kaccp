import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { improveEnglish } from '@/lib/ai'

const Schema = z.object({ text: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { text } = Schema.parse(await req.json())
    const ai = await improveEnglish(text)
    return NextResponse.json({ corrected: ai.corrected, model: ai.model, score: ai.score })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
