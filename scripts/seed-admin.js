/* Seed a master admin user using environment variables.
 * Required env:
 * - MASTER_ADMIN_EMAIL
 * - MASTER_ADMIN_PASSWORD
 * Optional env:
 * - MASTER_ADMIN_NAME
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const email = process.env.MASTER_ADMIN_EMAIL
  const password = process.env.MASTER_ADMIN_PASSWORD
  const displayName = process.env.MASTER_ADMIN_NAME || 'Master Admin'

  if (!email || !password) {
    console.error('Missing MASTER_ADMIN_EMAIL or MASTER_ADMIN_PASSWORD in env')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log('Master admin already exists:', existing.email)
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        role: 'ADMIN',
        isActive: true,
      },
      select: { id: true, email: true, role: true }
    })
    console.log('Created master admin:', user)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
