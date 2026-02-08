import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { requireAdmin } from '@/lib/infra/auth/auth'
import { z } from 'zod'

const ActionSchema = z.object({
  action: z.enum(['MARK_PAID', 'MARK_FAILED']),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const { action, notes } = ActionSchema.parse(await req.json())

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } })
      if (!payment) throw new Error('Payment not found')

      if (action === 'MARK_PAID') {
        // Mark payment as PAID, and register a debit wallet transaction.
        // Also decrement user's outstanding totalEarningsCents to reflect payout.
        await tx.payment.update({ where: { id }, data: { status: 'PAID', notes: notes ?? null } })
        await tx.walletTransaction.create({
          data: {
            userId: payment.userId,
            deltaCents: -Math.abs(payment.amountCents),
            description: `Payout for payment ${payment.id}`,
            relatedPaymentId: payment.id,
          },
        })
        await tx.user.update({
          where: { id: payment.userId },
          data: { totalEarningsCents: { decrement: Math.abs(payment.amountCents) } },
        })
      } else if (action === 'MARK_FAILED') {
        await tx.payment.update({ where: { id }, data: { status: 'FAILED', notes: notes ?? null } })
      }

      return { ok: true }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('admin/payments/[id] error', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
