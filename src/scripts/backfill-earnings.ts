
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Running backfill for missing transcriber earnings...')

    // 1. Get all approved transcriptions
    const approvedTranscriptions = await prisma.transcription.findMany({
        where: { status: 'APPROVED' },
        include: {
            recording: {
                include: {
                    language: true
                }
            }
        }
    })

    console.log(`Found ${approvedTranscriptions.length} approved transcriptions.`)

    for (const t of approvedTranscriptions) {
        // 2. Check if a wallet transaction exists for this transcription
        const existingTx = await prisma.walletTransaction.findFirst({
            where: {
                // We can match by description or relation if we had one. 
                // The current implementation puts the ID in description
                description: { contains: t.recordingId }
            }
        })

        if (!existingTx) {
            console.log(`Missing payment for transcription ${t.id} (User: ${t.transcriberId}). Backfilling...`)

            const ratePerMin = t.recording.language.transcriberRatePerMin || 0.03
            // If it was already approved, maybe we should use the current rate (1.5) if the old one was 0.03?
            // But let's stick to what's in the DB to be safe, or default to 1.5 if it's 0.03 (since we just changed the default)

            let effectiveRate = ratePerMin
            if (effectiveRate === 0.03) effectiveRate = 1.5 // Upgrade old default to new default

            const durationMin = Math.max(0.1, t.recording.durationSec / 60)
            const amountCents = Math.round(durationMin * effectiveRate * 100)

            if (amountCents > 0) {
                await prisma.$transaction([
                    prisma.walletTransaction.create({
                        data: {
                            userId: t.transcriberId,
                            deltaCents: amountCents,
                            description: `Approved transcription for recording ${t.recordingId} (Backfill)`
                        }
                    }),
                    prisma.user.update({
                        where: { id: t.transcriberId },
                        data: {
                            totalEarningsCents: { increment: amountCents }
                        }
                    })
                ])
                console.log(`-> Paid ${amountCents} cents to ${t.transcriberId}`)
            }
        } else {
            // console.log(`Payment already exists for ${t.id}`)
        }
    }

    console.log('Backfill complete.')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
