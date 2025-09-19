import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === '1'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)

    const where = unreadOnly ? { userId: user.id, readAt: null } : { userId: user.id }

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.notification.count({ where: { userId: user.id, readAt: null } })

    return NextResponse.json({ items, unreadCount })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({} as any))
    const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined
    const all: boolean = body.all === true

    if (!all && (!ids || ids.length === 0)) {
      return NextResponse.json({ error: 'Provide ids[] or set all=true' }, { status: 400 })
    }

    const where = all ? { userId: user.id, readAt: null } : { id: { in: ids! }, userId: user.id }
    const res = await prisma.notification.updateMany({ where, data: { readAt: new Date() } })
    return NextResponse.json({ ok: true, count: res.count })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
