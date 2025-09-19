/* Seed a default PaymentRatePlan if none is active */
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.paymentRatePlan.findFirst({ where: { active: true } })
    if (existing) {
      console.log('Active rate plan already exists:', existing.name, existing.ratePerMinuteCents, 'cents/min')
      return
    }

    const plan = await prisma.paymentRatePlan.create({
      data: {
        name: 'default-1.00-sle-per-minute',
        ratePerMinuteCents: 100, // 1.00 SLE per minute
        currency: 'SLE',
        active: true,
      },
    })

    console.log('Created default rate plan:', plan)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
