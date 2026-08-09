import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Set the transcriber pay rate to Le 3.00 per minute of audio for every
// language. Applied at review time (rate * audio minutes), so this affects
// future transcriptions only.
//
// Usage: npx tsx scripts/update-transcriber-rates.ts [--execute]

async function main() {
  const dryRun = !process.argv.includes("--execute");
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "EXECUTE"}`);

  const langs = await prisma.language.findMany({
    select: { id: true, code: true, name: true, transcriberRatePerMin: true },
    orderBy: { code: "asc" },
  });

  console.log("Current rates:");
  for (const l of langs) {
    console.log(`  ${l.code.padEnd(6)} ${(l.name || "").padEnd(20)} ${l.transcriberRatePerMin}`);
  }

  const rate = 3;
  const toUpdate = langs.filter((l) => l.transcriberRatePerMin !== rate);
  console.log(`\nLanguages to update to ${rate} LE/min: ${toUpdate.length}`);

  if (dryRun) {
    console.log("\nDRY RUN - pass --execute to apply.");
    return;
  }

  for (const l of toUpdate) {
    await prisma.language.update({
      where: { id: l.id },
      data: { transcriberRatePerMin: rate },
    });
    console.log(`Updated ${l.code} -> ${rate} LE/min`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
