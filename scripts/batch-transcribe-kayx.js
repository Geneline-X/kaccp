#!/usr/bin/env node
/**
 * Batch Transcribe Krio Recordings with Kay X
 * 
 * This script finds all Krio recordings without Kay X transcripts
 * and sends them to Kay X for automatic transcription.
 * 
 * Usage:
 *   node scripts/batch-transcribe-kayx.js [--limit=10] [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const { Storage } = require('@google-cloud/storage');

const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null;
const dryRun = args.includes('--dry-run');

// Kay X config
const KAY_X_BASE_URL = process.env.ASR_GATEWAY_URL || 'http://localhost:8081';
const KAY_X_API_KEY = process.env.ASR_API_KEY;
const KAY_X_ENABLED = process.env.KAY_X_ENABLED === 'true';

// GCS config for signed URLs
const storage = new Storage({
  credentials: JSON.parse(process.env.GCS_SERVICE_ACCOUNT_JSON || '{}'),
});
const bucket = storage.bucket(process.env.GCS_BUCKET || '');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function generateSignedUrl(gsUrl) {
  if (!gsUrl.startsWith('gs://')) {
    return gsUrl; // Already HTTP/HTTPS
  }

  const filePath = gsUrl.replace(`gs://${process.env.GCS_BUCKET}/`, '');
  const [signedUrl] = await bucket.file(filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
  });

  return signedUrl;
}

async function transcribeWithKayX(audioUrl) {
  const response = await fetch(`${KAY_X_BASE_URL}/api/v1/transcribe_url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': KAY_X_API_KEY,
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kay X API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    transcript: data.krio_text || '',
    english: data.english || '',
    metadata: data,
  };
}

async function main() {
  log('\n🤖 Kay X Batch Transcription Script\n', 'blue');

  // Check configuration
  if (!KAY_X_ENABLED) {
    log('❌ Kay X is not enabled (KAY_X_ENABLED=true)', 'red');
    process.exit(1);
  }

  if (!KAY_X_API_KEY) {
    log('❌ Kay X API key not configured (ASR_API_KEY)', 'red');
    process.exit(1);
  }

  log(`📍 Kay X URL: ${KAY_X_BASE_URL}`, 'gray');
  log(`🔑 API Key: ${KAY_X_API_KEY.substring(0, 15)}...`, 'gray');
  if (dryRun) {
    log('🏃 DRY RUN MODE - No changes will be made\n', 'yellow');
  }

  // Find Krio recordings without transcripts
  const where = {
    language: {
      code: {
        equals: 'kri',
        mode: 'insensitive',
      },
    },
    autoTranscriptionStatus: {
      in: ['PENDING', 'FAILED', 'SKIPPED'],
    },
  };

  const recordings = await prisma.recording.findMany({
    where,
    include: {
      language: true,
      prompt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit || undefined,
  });

  log(`\n📊 Found ${recordings.length} Krio recordings to transcribe\n`, 'blue');

  if (recordings.length === 0) {
    log('✅ All Krio recordings already transcribed!', 'green');
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    log('Would transcribe the following recordings:', 'yellow');
    recordings.forEach((rec, i) => {
      log(`  ${i + 1}. ${rec.id} - "${rec.prompt.englishText.substring(0, 50)}..."`, 'gray');
    });
    await prisma.$disconnect();
    return;
  }

  // Process recordings
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < recordings.length; i++) {
    const rec = recordings[i];
    const progress = `[${i + 1}/${recordings.length}]`;

    try {
      log(`${progress} Processing: ${rec.id}`, 'blue');
      log(`  Prompt: "${rec.prompt.englishText.substring(0, 60)}..."`, 'gray');

      // Generate signed URL if needed
      const audioUrl = await generateSignedUrl(rec.audioUrl);
      log(`  Audio URL: ${audioUrl.substring(0, 80)}...`, 'gray');

      // Transcribe with Kay X
      log('  🤖 Sending to Kay X...', 'yellow');
      const result = await transcribeWithKayX(audioUrl);

      // Update database
      await prisma.recording.update({
        where: { id: rec.id },
        data: {
          transcript: result.transcript,
          transcriptConfidence: null,
          autoTranscriptionStatus: 'COMPLETED',
          autoTranscribedAt: new Date(),
          transcriptMetadata: {
            krio_text: result.transcript,
            english: result.english,
            raw_response: result.metadata,
          },
        },
      });

      log(`  ✅ Krio: ${result.transcript.substring(0, 60)}...`, 'green');
      log(`  📝 English: ${result.english.substring(0, 60)}...\n`, 'gray');
      successful++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      log(`  ❌ Error: ${error.message}\n`, 'red');
      
      // Mark as failed in DB
      await prisma.recording.update({
        where: { id: rec.id },
        data: {
          autoTranscriptionStatus: 'FAILED',
          autoTranscribedAt: new Date(),
          transcriptMetadata: {
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        },
      });
      
      failed++;
    }
  }

  // Summary
  log('\n' + '='.repeat(50), 'blue');
  log('📊 Batch Transcription Summary', 'blue');
  log('='.repeat(50), 'blue');
  log(`✅ Successful: ${successful}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`📝 Total: ${recordings.length}\n`, 'blue');

  await prisma.$disconnect();
}

// Run
main()
  .catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
