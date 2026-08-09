import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const langs = await prisma.language.findMany({
    select: { code: true, name: true, transcriberRatePerMin: true },
    orderBy: { code: "asc" },
  });
  console.log("Language rates:");
  for (const l of langs) {
    console.log(`${l.code.padEnd(6)} ${(l.name || "").padEnd(20)} transcriberRatePerMin=${l.transcriberRatePerMin ?? "(null)"}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
