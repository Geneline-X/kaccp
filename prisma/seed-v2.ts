import { PrismaClient, PromptCategory, PromptEmotion } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding V2 database...");

  // Create admin user
  const adminPassword = await bcrypt.hash(
    process.env.MASTER_ADMIN_PASSWORD || "admin123",
    10
  );

  const admin = await prisma.user.upsert({
    where: { email: process.env.MASTER_ADMIN_EMAIL || "admin@kaccp.com" },
    update: {},
    create: {
      email: process.env.MASTER_ADMIN_EMAIL || "admin@kaccp.com",
      displayName: process.env.MASTER_ADMIN_NAME || "Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
      phone: "+23200000000",
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Create Sierra Leone
  const sierraLeone = await prisma.country.upsert({
    where: { code: "SL" },
    update: {},
    create: {
      code: "SL",
      name: "Sierra Leone",
    },
  });
  console.log("✅ Country created:", sierraLeone.name);

  // Create languages for Sierra Leone
  const languages = [
    { code: "kri", name: "Krio", nativeName: "Krio" },
    { code: "men", name: "Mende", nativeName: "Mɛnde" },
    { code: "tem", name: "Temne", nativeName: "Temne" },
  ];

  for (const lang of languages) {
    const language = await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: {
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        countryId: sierraLeone.id,
        targetMinutes: 12000, // 200 hours
        speakerRatePerMinute: 0.05,
        transcriberRatePerMin: 0.03,
      },
    });
    console.log("✅ Language created:", language.name);

    // Create sample prompts for each language
    const samplePrompts = [
      // Greetings
      { text: "Good morning, how are you?", category: PromptCategory.GREETINGS, emotion: PromptEmotion.NEUTRAL },
      { text: "Hello, nice to meet you!", category: PromptCategory.GREETINGS, emotion: PromptEmotion.HAPPY },
      { text: "Goodbye, see you later!", category: PromptCategory.GREETINGS, emotion: PromptEmotion.NEUTRAL },
      { text: "Good evening, how was your day?", category: PromptCategory.GREETINGS, emotion: PromptEmotion.NEUTRAL },
      { text: "Welcome to my home!", category: PromptCategory.GREETINGS, emotion: PromptEmotion.HAPPY },

      // Numbers & Money
      { text: "One, two, three, four, five", category: PromptCategory.NUMBERS_MONEY, emotion: PromptEmotion.NEUTRAL },
      { text: "The price is fifty thousand leones", category: PromptCategory.NUMBERS_MONEY, emotion: PromptEmotion.NEUTRAL },
      { text: "I have one hundred dollars", category: PromptCategory.NUMBERS_MONEY, emotion: PromptEmotion.NEUTRAL },

      // Questions
      { text: "What is your name?", category: PromptCategory.QUESTIONS, emotion: PromptEmotion.QUESTION },
      { text: "Where are you going?", category: PromptCategory.QUESTIONS, emotion: PromptEmotion.QUESTION },
      { text: "How much does this cost?", category: PromptCategory.QUESTIONS, emotion: PromptEmotion.QUESTION },
      { text: "When will you come back?", category: PromptCategory.QUESTIONS, emotion: PromptEmotion.QUESTION },

      // Commands & Requests
      { text: "Please come here", category: PromptCategory.COMMANDS_REQUESTS, emotion: PromptEmotion.NEUTRAL },
      { text: "Help me with this", category: PromptCategory.COMMANDS_REQUESTS, emotion: PromptEmotion.URGENT },
      { text: "Wait for me please", category: PromptCategory.COMMANDS_REQUESTS, emotion: PromptEmotion.NEUTRAL },

      // Emotions Happy
      { text: "I am so happy today!", category: PromptCategory.EMOTIONS_HAPPY, emotion: PromptEmotion.HAPPY },
      { text: "This is wonderful news!", category: PromptCategory.EMOTIONS_HAPPY, emotion: PromptEmotion.EXCITED },
      { text: "Thank you very much!", category: PromptCategory.EMOTIONS_HAPPY, emotion: PromptEmotion.HAPPY },

      // Emotions Sad
      { text: "I am very sad", category: PromptCategory.EMOTIONS_SAD, emotion: PromptEmotion.SAD },
      { text: "This makes me angry", category: PromptCategory.EMOTIONS_SAD, emotion: PromptEmotion.ANGRY },

      // Daily Life
      { text: "I am going to work now", category: PromptCategory.DAILY_LIFE, emotion: PromptEmotion.NEUTRAL },
      { text: "The food is ready", category: PromptCategory.DAILY_LIFE, emotion: PromptEmotion.NEUTRAL },
      { text: "I need to go to the market", category: PromptCategory.DAILY_LIFE, emotion: PromptEmotion.NEUTRAL },

      // Market & Shopping
      { text: "How much is this?", category: PromptCategory.MARKET_SHOPPING, emotion: PromptEmotion.QUESTION },
      { text: "That is too expensive", category: PromptCategory.MARKET_SHOPPING, emotion: PromptEmotion.NEUTRAL },
      { text: "Give me a discount please", category: PromptCategory.MARKET_SHOPPING, emotion: PromptEmotion.NEUTRAL },

      // Directions & Places
      { text: "Turn left at the corner", category: PromptCategory.DIRECTIONS_PLACES, emotion: PromptEmotion.NEUTRAL },
      { text: "The school is near the market", category: PromptCategory.DIRECTIONS_PLACES, emotion: PromptEmotion.NEUTRAL },
      { text: "Go straight ahead", category: PromptCategory.DIRECTIONS_PLACES, emotion: PromptEmotion.NEUTRAL },

      // Family & People
      { text: "My mother is at home", category: PromptCategory.FAMILY_PEOPLE, emotion: PromptEmotion.NEUTRAL },
      { text: "The children are playing outside", category: PromptCategory.FAMILY_PEOPLE, emotion: PromptEmotion.NEUTRAL },

      // Health
      { text: "I feel sick today", category: PromptCategory.HEALTH, emotion: PromptEmotion.SAD },
      { text: "Where is the hospital?", category: PromptCategory.HEALTH, emotion: PromptEmotion.QUESTION },
      { text: "I need medicine", category: PromptCategory.HEALTH, emotion: PromptEmotion.URGENT },

      // Weather & Time
      { text: "It is raining outside", category: PromptCategory.WEATHER_TIME, emotion: PromptEmotion.NEUTRAL },
      { text: "The sun is very hot today", category: PromptCategory.WEATHER_TIME, emotion: PromptEmotion.NEUTRAL },
      { text: "I will come tomorrow morning", category: PromptCategory.WEATHER_TIME, emotion: PromptEmotion.NEUTRAL },

      // Local Scenarios
      { text: "The okada is coming", category: PromptCategory.LOCAL_SCENARIOS, emotion: PromptEmotion.NEUTRAL },
      { text: "Let us go to the beach", category: PromptCategory.LOCAL_SCENARIOS, emotion: PromptEmotion.HAPPY },
      { text: "The power has gone", category: PromptCategory.LOCAL_SCENARIOS, emotion: PromptEmotion.SAD },
    ];

    // Check if prompts already exist for this language
    const existingCount = await prisma.prompt.count({
      where: { languageId: language.id },
    });

    if (existingCount === 0) {
      await prisma.prompt.createMany({
        data: samplePrompts.map((p) => ({
          languageId: language.id,
          englishText: p.text,
          category: p.category,
          emotion: p.emotion,
          targetDurationSec: 5,
        })),
      });
      console.log(`  ✅ Created ${samplePrompts.length} prompts for ${language.name}`);
    } else {
      console.log(`  ⏭️ Skipped prompts for ${language.name} (already exist)`);
    }
  }

  // Create Guinea
  const guinea = await prisma.country.upsert({
    where: { code: "GN" },
    update: {},
    create: {
      code: "GN",
      name: "Guinea",
    },
  });
  console.log("✅ Country created:", guinea.name);

  // Create languages for Guinea
  const guineaLanguages = [
    { code: "sus", name: "Susu", nativeName: "Sosoxui" },
    { code: "man", name: "Mandinka", nativeName: "Mandinka" },
  ];

  for (const lang of guineaLanguages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: {
        code: lang.code,
        name: lang.name,
        nativeName: lang.nativeName,
        countryId: guinea.id,
        targetMinutes: 12000,
        speakerRatePerMinute: 0.05,
        transcriberRatePerMin: 0.03,
      },
    });
    console.log("✅ Language created:", lang.name);
  }

  console.log("\n🎉 V2 Seed completed!");
  console.log("\n📋 Summary:");
  console.log("  - Admin user: " + (process.env.MASTER_ADMIN_EMAIL || "admin@kaccp.com"));
  console.log("  - Countries: Sierra Leone, Guinea");
  console.log("  - Languages: Krio, Mende, Temne, Susu, Mandinka");
  console.log("  - Sample prompts created for SL languages");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
