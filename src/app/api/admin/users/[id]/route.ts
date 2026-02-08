import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { requireAdmin } from '@/lib/infra/auth/auth'
import { z } from 'zod'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    const user = await (prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        displayName: true,
        role: true,
        roles: true,
        createdAt: true,
        lastLoginAt: true,
        qualityScore: true,
        totalEarningsCents: true,
        avatarUrl: true,
        speaksLanguages: true,
        writesLanguages: true,
      } as any,
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // V1 Stats removed to fix build
    const reviewsCount = 0
    const uploadsCount = 0
    const recentReviews: any[] = []
    const recentPayments = await prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, amountCents: true, currency: true, status: true, createdAt: true } })

    const approvedMinutes = 0
    const statusCounts = {}

    return NextResponse.json({
      user,
      stats: {
        reviewsCount,
        uploadsCount,
        approvedMinutes,
        statusCounts,
      },
      recent: {
        reviews: recentReviews,
        payments: recentPayments,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}

const PatchSchema = z.object({
  role: z.enum(['ADMIN', 'SPEAKER', 'TRANSCRIBER', 'REVIEWER']).optional(),
  roles: z.array(z.enum(['ADMIN', 'SPEAKER', 'TRANSCRIBER', 'REVIEWER'])).optional(),
  isActive: z.boolean().optional(),
  speaksLanguages: z.array(z.string()).optional(),
  writesLanguages: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const data = PatchSchema.parse(body)

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Safeguards: cannot remove last active admin; prevent self-demotion if last admin
    const isDemotingAdmin = data.role === 'TRANSCRIBER' && target.role === 'ADMIN'
    const isDeactivatingAdmin = data.isActive === false && target.role === 'ADMIN'
    if (isDemotingAdmin || isDeactivatingAdmin) {
      const otherActiveAdmins = await prisma.user.count({ where: { role: 'ADMIN' as any, isActive: true, id: { not: target.id } } })
      if (otherActiveAdmins === 0) {
        return NextResponse.json({ error: 'Cannot remove the last active admin' }, { status: 400 })
      }
    }
    // Optional: block self-demotion if last admin
    if ((isDemotingAdmin || isDeactivatingAdmin) && admin.id === target.id) {
      const otherActiveAdmins = await prisma.user.count({ where: { role: 'ADMIN' as any, isActive: true, id: { not: admin.id } } })
      if (otherActiveAdmins === 0) {
        return NextResponse.json({ error: 'You cannot remove your own admin access as the last admin' }, { status: 400 })
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.role ? { role: data.role as any } : {}),
        ...(data.roles ? { roles: data.roles as any } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.speaksLanguages ? { speaksLanguages: data.speaksLanguages } : {}),
        ...(data.writesLanguages ? { writesLanguages: data.writesLanguages } : {}),
      },
      select: { id: true, email: true, role: true, roles: true, isActive: true, speaksLanguages: true, writesLanguages: true },
    })

    return NextResponse.json({ user: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (target.role === 'ADMIN' && target.isActive) {
      const otherActiveAdmins = await prisma.user.count({ where: { role: 'ADMIN' as any, isActive: true, id: { not: target.id } } })
      if (otherActiveAdmins === 0) {
        return NextResponse.json({ error: 'Cannot delete the last active admin' }, { status: 400 })
      }
    }
    if (admin.id === target.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({}, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
