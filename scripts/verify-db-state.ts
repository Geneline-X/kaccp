import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='ReviewQueue' ORDER BY ordinal_position`
  ) as { column_name: string }[];
  console.log("ReviewQueue has rejectionFeedback:", cols.some((c) => c.column_name === "rejectionFeedback"));

  const rejected = await prisma.transcription.findMany({
    where: { status: "REJECTED" },
    select: { recordingId: true, recording: { select: { status: true } } },
  });
  console.log("\nREJECTED transcriptions (5 expected):");
  for (const t of rejected) {
    console.log(`${t.recordingId} -> recording.status = ${t.recording.status}`);
  }

  const feedbackCount = await prisma.reviewQueue.count({
    where: { rejectionFeedback: { not: Prisma.DbNull } },
  });
  console.log(`\nReviewQueue items with rejectionFeedback set: ${feedbackCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
