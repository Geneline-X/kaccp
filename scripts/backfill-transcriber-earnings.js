#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/*
Backfill transcriber earnings that were never credited.

Two gaps are repaired:
  (a) Classic APPROVED transcriptions that produced no wallet ledger entry
      (short Krio clips were rounded to 0 cents while the rate was 0.03/min).
  (b) Pipeline ReviewQueue corrections / verifications, which never paid at all
      until the crediting code was added.

The wallet ledger (walletTransaction) is authoritative; User.totalEarningsCents is
a cache of SUM(deltaCents). This script creates the missing ledger entries and then
recomputes totalEarningsCents for every affected user.

Idempotent: an entry is only created if no wallet transaction with the same
description already exists for that user, so re-running is safe.

Usage:
  node --env-file=.env scripts/backfill-transcriber-earnings.js            # dry-run (default)
  node --env-file=.env scripts/backfill-transcriber-earnings.js --commit   # write changes
*/

try {
  require('dotenv').config()
} catch {
  // dotenv not installed; env provided via --env-file or the shell
}
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const COMMIT = process.argv.includes('--commit')

// Mirror of src/lib/domain/payments#transcriberCents
function transcriberCents(durationSec, ratePerMin) {
  if (!ratePerMin || ratePerMin <= 0) return 0
  const durationMin = Math.max(0.1, durationSec / 60)
  return Math.max(1, Math.round(durationMin * ratePerMin * 100))
}

async function main() {
  /** @type {Map<string, {label: string, cents: number, entries: number}>} */
  const perUser = new Map()
  const toCreate = [] // { userId, deltaCents, description }

  const userLabel = new Map()
  const labelOf = async (userId) => {
    if (userLabel.has(userId)) return userLabel.get(userId)
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } })
    const label = u ? (u.email || u.displayName || userId) : `(missing user ${userId})`
    userLabel.set(userId, label)
    return label
  }

  const queue = async (userId, deltaCents, description) => {
    // Skip if this exact credit already exists in the ledger (idempotency).
    const existing = await prisma.walletTransaction.count({ where: { userId, description } })
    if (existing > 0) return false
    toCreate.push({ userId, deltaCents, description })
    const label = await labelOf(userId)
    const agg = perUser.get(userId) || { label, cents: 0, entries: 0 }
    agg.cents += deltaCents
    agg.entries += 1
    perUser.set(userId, agg)
    return true
  }

  // ---- (a) Classic APPROVED transcriptions ---------------------------------
  const approved = await prisma.transcription.findMany({
    where: { status: 'APPROVED' },
    select: {
      recordingId: true,
      transcriberId: true,
      recording: { select: { durationSec: true, language: { select: { transcriberRatePerMin: true } } } },
    },
  })
  let classicCredited = 0
  for (const tx of approved) {
    const rate = tx.recording?.language?.transcriberRatePerMin || 0.03
    const cents = transcriberCents(tx.recording?.durationSec || 0, rate)
    if (cents <= 0) continue
    const desc = `Approved transcription for recording ${tx.recordingId}`
    if (await queue(tx.transcriberId, cents, desc)) classicCredited++
  }

  // ---- (b) Pipeline ReviewQueue corrections / verifications ----------------
  const krio = await prisma.language.findFirst({ where: { code: 'kri' }, select: { transcriberRatePerMin: true } })
  const krioRate = krio?.transcriberRatePerMin || 3

  const items = await prisma.reviewQueue.findMany({
    where: { OR: [{ reviewerId: { not: null } }, { secondReviewerId: { not: null } }] },
    select: { id: true, reviewerId: true, secondReviewerId: true, audioSessionId: true, recordingId: true },
  })

  // Batch-resolve durations.
  const sessionIds = [...new Set(items.map((i) => i.audioSessionId).filter(Boolean))]
  const recordingIds = [...new Set(items.map((i) => i.recordingId).filter(Boolean))]
  const sessions = sessionIds.length
    ? await prisma.audioSession.findMany({ where: { id: { in: sessionIds } }, select: { id: true, audioDurationS: true } })
    : []
  const recordings = recordingIds.length
    ? await prisma.recording.findMany({ where: { id: { in: recordingIds } }, select: { id: true, durationSec: true } })
    : []
  const sessionDur = new Map(sessions.map((s) => [s.id, s.audioDurationS]))
  const recordingDur = new Map(recordings.map((r) => [r.id, r.durationSec]))
  const durationOf = (item) =>
    (item.audioSessionId && sessionDur.get(item.audioSessionId)) ||
    (item.recordingId && recordingDur.get(item.recordingId)) ||
    0

  let pipelineCredited = 0
  for (const item of items) {
    const cents = transcriberCents(durationOf(item), krioRate)
    if (cents <= 0) continue
    if (item.reviewerId) {
      const desc = `Pipeline first-pass correction for review item ${item.id}`
      if (await queue(item.reviewerId, cents, desc)) pipelineCredited++
    }
    if (item.secondReviewerId) {
      const desc = `Pipeline second-pass correction for review item ${item.id}`
      if (await queue(item.secondReviewerId, cents, desc)) pipelineCredited++
    }
  }

  // ---- Report --------------------------------------------------------------
  const grandCents = toCreate.reduce((n, e) => n + e.deltaCents, 0)
  console.log(`\n${COMMIT ? 'COMMIT' : 'DRY-RUN'} — backfill transcriber earnings`)
  console.log(`  classic ledger entries to add:  ${classicCredited}`)
  console.log(`  pipeline ledger entries to add: ${pipelineCredited}`)
  console.log(`  total ledger entries:           ${toCreate.length}`)
  console.log(`  total to credit:                Le${(grandCents / 100).toFixed(2)}\n`)

  const rows = [...perUser.values()]
    .sort((a, b) => b.cents - a.cents)
    .map((r) => ({ user: r.label, entries: r.entries, credit: `Le${(r.cents / 100).toFixed(2)}` }))
  if (rows.length) console.table(rows)
  else console.log('Nothing to backfill — ledger already up to date.')

  if (!COMMIT) {
    console.log('\nDry-run only. Re-run with --commit to write these entries.')
    return
  }

  // Write ledger entries, then recompute the totalEarningsCents cache.
  if (toCreate.length) {
    await prisma.walletTransaction.createMany({ data: toCreate })
  }
  const affected = [...perUser.keys()]
  for (const userId of affected) {
    const agg = await prisma.walletTransaction.aggregate({ _sum: { deltaCents: true }, where: { userId } })
    await prisma.user.update({ where: { id: userId }, data: { totalEarningsCents: agg._sum.deltaCents || 0 } })
  }
  console.log(`\nCommitted ${toCreate.length} ledger entries; recomputed totals for ${affected.length} user(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
