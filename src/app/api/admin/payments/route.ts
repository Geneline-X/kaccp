import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/infra/db/prisma'
import { requireAdmin } from '@/lib/infra/auth/auth'
import { z } from 'zod'
import { Currency } from '@prisma/client'

// GET: list balances (aggregate wallet transactions) and payments
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Aggregate user balances using totalEarningsCents as the running credit
    const users = await prisma.user.findMany({
      select: { id: true, email: true, displayName: true, totalEarningsCents: true },
      orderBy: { totalEarningsCents: 'desc' },
      take: 200,
    })

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ users, payments })
  } catch (e) {
    console.error('admin/payments GET error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: create a new Payment record (payout run) for a user
const CreatePaymentSchema = z.object({
  userId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.nativeEnum(Currency).default(Currency.SLE),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { userId, amountCents, currency, reference, notes } = CreatePaymentSchema.parse(await req.json())

    const payment = await prisma.payment.create({
      data: {
        userId,
        amountCents,
        currency,
        status: 'PENDING',
        reference: reference ?? null,
        notes: notes ?? null,
      },
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (e: any) {
    console.error('admin/payments POST error', e)
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}
