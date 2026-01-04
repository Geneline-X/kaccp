#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
Recompute User.totalEarningsCents from the authoritative wallet ledger.

Examples:
  node scripts/recompute-total-earnings.js --email paul@example.com
  node scripts/recompute-total-earnings.js --name paul
  node scripts/recompute-total-earnings.js --userId <uuid>
  node scripts/recompute-total-earnings.js --all
  node scripts/recompute-total-earnings.js --email paul@example.com --dry-run

Notes:
- This script sets totalEarningsCents = SUM(walletTransaction.deltaCents) for each matched user.
- Use --dry-run first to preview changes.
*/

try {
  require('dotenv').config()
} catch {
  // dotenv not installed; proceed assuming env vars are provided by the shell
}
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { dryRun: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--all') out.all = true
    else if (a === '--email') out.email = args[++i]
    else if (a === '--name') out.name = args[++i]
    else if (a === '--userId') out.userId = args[++i]
    else {
      console.warn(`Unknown arg: ${a}`)
    }
  }
  return out
}

async function main() {
  const opts = parseArgs()
  if (!opts.all && !opts.email && !opts.name && !opts.userId) {
    console.log('Specify a selector: --email, --name, --userId or use --all')
    process.exit(1)
  }

  const userWhere = {}
  if (opts.userId) userWhere.id = opts.userId
  if (opts.email) userWhere.email = opts.email
  if (opts.name) userWhere.displayName = { contains: opts.name, mode: 'insensitive' }

  const users = await prisma.user.findMany({
    where: opts.all ? {} : userWhere,
    select: { id: true, email: true, displayName: true, totalEarningsCents: true },
    orderBy: { createdAt: 'asc' },
    take: opts.all ? undefined : 100,
  })

  if (!users.length) {
    console.log('No matching users found')
    return
  }

  let changed = 0
  for (const u of users) {
    const agg = await prisma.walletTransaction.aggregate({
      _sum: { deltaCents: true },
      where: { userId: u.id },
    })
    const computed = agg._sum.deltaCents || 0
    const current = u.totalEarningsCents || 0
    const diff = computed - current

    if (diff === 0) {
      console.log(`OK   ${u.displayName || u.email} (${u.id}) total=${current} matches ledger`)
      continue
    }

    if (opts.dryRun) {
      console.log(`DRY  ${u.displayName || u.email} (${u.id}) total=${current} -> ${computed} (diff ${diff})`)
    } else {
      await prisma.user.update({ where: { id: u.id }, data: { totalEarningsCents: computed } })
      console.log(`FIX  ${u.displayName || u.email} (${u.id}) total=${current} -> ${computed} (diff ${diff})`)
      changed++
    }
  }

  if (!opts.dryRun) console.log(`Updated ${changed} user(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
