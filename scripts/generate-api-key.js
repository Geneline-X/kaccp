#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* Generate an API key and print it. Run: node scripts/generate-api-key.js <name> */
const crypto = require('crypto');

const KEY_PREFIX = 'kaccp_sk_';
const KEY_BYTES = 32;

function generateApiKey(name) {
  const random = crypto.randomBytes(KEY_BYTES).toString('hex');
  const raw = `${KEY_PREFIX}${random}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 18);
  return { raw, hash, prefix };
}

const name = process.argv[2] || 'manual-key';
const { raw, hash, prefix } = generateApiKey(name);

console.log('\n=== API Key ===');
console.log(`Key:   ${raw}`);
console.log(`Hash:  ${hash}`);
console.log(`Name:  ${name}`);
console.log('\nSend requests with:');
console.log(`Authorization: Bearer ${raw}`);
console.log('\nInsert into DB manually:');
console.log(`INSERT INTO "ApiKey" (id, name, "keyHash", prefix, "isActive", "createdAt", "updatedAt")`);
console.log(`VALUES (gen_random_uuid(), '${name}', '${hash}', '${prefix}', true, NOW(), NOW());`);
console.log('');
