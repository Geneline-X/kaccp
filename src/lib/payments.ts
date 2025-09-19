import type { Prisma, PrismaClient } from '@prisma/client'

export async function getActiveRatePlan(prisma: PrismaClient) {
  const plan = await prisma.paymentRatePlan.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!plan) throw new Error('No active PaymentRatePlan found')
  return plan
}

export function calcCentsForDuration(durationSec: number, ratePerMinuteCents: number) {
  const minutes = Math.max(1, Math.ceil(durationSec / 60))
  return minutes * ratePerMinuteCents
}

export async function creditUserForApproval(
  tx: Prisma.TransactionClient,
  params: { userId: string; chunkId: string; durationSec: number; currency?: 'USD' | 'SLE' }
) {
  const plan = await (tx as any).paymentRatePlan.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
  if (!plan) throw new Error('No active PaymentRatePlan found')
  const amountCents = calcCentsForDuration(params.durationSec, plan.ratePerMinuteCents)

  await (tx as any).walletTransaction.create({
    data: {
      userId: params.userId,
      deltaCents: amountCents,
      description: `Approved transcription for chunk ${params.chunkId}`,
    },
  })

  await (tx as any).user.update({
    where: { id: params.userId },
    data: { totalEarningsCents: { increment: amountCents } },
  })

  return amountCents
}
