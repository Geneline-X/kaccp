import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSignedUrl } from '@/lib/gcs'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    // Require auth (transcriber or admin)
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const chunk = await prisma.audioChunk.findUnique({ where: { id } })
    if (!chunk) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })

    const url = await getSignedUrl(chunk.storageUri)
    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
