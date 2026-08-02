import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.recording.count({
    where: {
      audioUrl: { contains: "kri_speaker_" },
      language: { code: "kri" },
    },
  });

  const status = await prisma.recording.groupBy({
    by: ["status"],
    where: {
      audioUrl: { contains: "kri_speaker_" },
      language: { code: "kri" },
    },
    _count: true,
  });

  const autoTx = await prisma.recording.groupBy({
    by: ["autoTranscriptionStatus"],
    where: {
      audioUrl: { contains: "kri_speaker_" },
      language: { code: "kri" },
    },
    _count: true,
  });

  const withTranscript = await prisma.recording.count({
    where: {
      audioUrl: { contains: "kri_speaker_" },
      language: { code: "kri" },
      transcript: { not: null },
    },
  });

  const pendingTx = await prisma.recording.count({
    where: {
      audioUrl: { contains: "kri_speaker_" },
      language: { code: "kri" },
      status: "PENDING_TRANSCRIPTION",
    },
  });

  console.log(`Total Krio speaker recordings: ${total}`);
  console.log(`With transcript: ${withTranscript}`);
  console.log(`Ready for transcription queue (PENDING_TRANSCRIPTION): ${pendingTx}`);
  console.log("\nBy status:");
  for (const s of status) {
    console.log(`  ${s.status}: ${s._count}`);
  }
  console.log("\nBy auto transcription status:");
  for (const a of autoTx) {
    console.log(`  ${a.autoTranscriptionStatus}: ${a._count}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
