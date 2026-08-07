import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Re-queue recordings whose transcription was REJECTED but whose Recording.status
// was never reset to PENDING_TRANSCRIPTION (legacy rejections made before the
// re-queue logic existed in /api/v2/admin/review). These recordings must return
// to the transcriber available pool so a transcriber can redo them.
//
// Usage: npx tsx scripts/requeue-rejected.ts [--execute]

async function main() {
  const dryRun = !process.argv.includes("--execute");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);

  const rejected = await prisma.transcription.findMany({
    where: { status: "REJECTED" },
    select: {
      recordingId: true,
      transcriberId: true,
      recording: {
        select: { id: true, status: true, audioUrl: true, language: { select: { code: true } } },
      },
    },
  });

  const toFix = rejected.filter(
    (t) => t.recording && t.recording.status !== "PENDING_TRANSCRIPTION"
  );

  console.log(`REJECTED transcription rows: ${rejected.length}`);
  console.log(`Recordings needing re-queue (status != PENDING_TRANSCRIPTION): ${toFix.length}\n`);

  for (const t of toFix) {
    console.log(
      `${t.recording.status.padEnd(20)} ${t.recording.audioUrl}`
    );
  }

  if (dryRun) {
    console.log("\nDRY RUN - pass --execute to apply.");
    return;
  }

  for (const t of toFix) {
    await prisma.recording.update({
      where: { id: t.recordingId },
      data: { status: "PENDING_TRANSCRIPTION" },
    });
    console.log(`Re-queued ${t.recordingId} -> PENDING_TRANSCRIPTION`);
  }

  console.log(`\nDone. ${toFix.length} recording(s) returned to the transcriber pool.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
