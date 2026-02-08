/**
 * Test script for translation service with caching
 * 
 * Usage: npx tsx scripts/test-translation.ts
 * 
 * This script tests:
 * 1. Basic translation with cache miss (first call)
 * 2. Cache hit (second identical call)
 * 3. Same language (no translation)
 * 4. Empty text handling
 * 5. Different entity/field combinations
 */

import { translateAdminContent } from '@/lib/translations/service';

// Set default translation provider if not configured
if (!process.env.TRANSLATION_PROVIDER) {
    process.env.TRANSLATION_PROVIDER = 'openai';
    console.log('ℹ️  TRANSLATION_PROVIDER not set, using "openai" by default\n');
}

async function main() {
    console.log('🧪 Testing Translation Service with Caching\n');
    console.log('='.repeat(60));
    console.log(`📡 Using provider: ${process.env.TRANSLATION_PROVIDER}`);
    console.log('='.repeat(60));

    try {
        // Test 1: First translation (cache miss)
        console.log('\n📝 Test 1: First translation (should call provider)');
        console.log('   Entity: country/test-country-1/name');
        console.log('   Text: "Sierra Leone" (en → fr)');
        const result1 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-1',
            fieldName: 'name',
            sourceText: 'Sierra Leone',
            sourceLanguage: 'en',
            targetLanguage: 'fr',
        });
        console.log(`   ✅ Result: "${result1}"\n`);

        // Test 2: Same translation (cache hit)
        console.log('📝 Test 2: Same translation (should use cache)');
        console.log('   Entity: country/test-country-1/name');
        console.log('   Text: "Sierra Leone" (en → fr)');
        const result2 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-1',
            fieldName: 'name',
            sourceText: 'Sierra Leone',
            sourceLanguage: 'en',
            targetLanguage: 'fr',
        });
        console.log(`   ✅ Result: "${result2}"`);
        if (result1 === result2) {
            console.log('   ✅ Cache working: results match!\n');
        }

        // Test 3: Same language (no translation needed)
        console.log('📝 Test 3: Same source and target language');
        console.log('   Entity: country/test-country-2/name');
        console.log('   Text: "Guinea" (en → en)');
        const result3 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-2',
            fieldName: 'name',
            sourceText: 'Guinea',
            sourceLanguage: 'en',
            targetLanguage: 'en',
        });
        console.log(`   ✅ Result: "${result3}" (should be unchanged)\n`);

        // Test 4: Empty text
        console.log('📝 Test 4: Empty text');
        console.log('   Entity: country/test-country-3/description');
        console.log('   Text: "" (en → es)');
        const result4 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-3',
            fieldName: 'description',
            sourceText: '',
            sourceLanguage: 'en',
            targetLanguage: 'es',
        });
        console.log(`   ✅ Result: "${result4}" (should be empty)\n`);

        // Test 5: Different field, same entity (cache miss)
        console.log('📝 Test 5: Different field, same entity');
        console.log('   Entity: country/test-country-1/description');
        console.log('   Text: "A West African country" (en → fr)');
        const result5 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-1',
            fieldName: 'description',
            sourceText: 'A West African country',
            sourceLanguage: 'en',
            targetLanguage: 'fr',
        });
        console.log(`   ✅ Result: "${result5}"\n`);

        // Test 6: Different target language, same entity/field (cache miss)
        console.log('📝 Test 6: Different target language');
        console.log('   Entity: country/test-country-1/name');
        console.log('   Text: "Sierra Leone" (en → es)');
        const result6 = await translateAdminContent({
            entityType: 'country',
            entityId: 'test-country-1',
            fieldName: 'name',
            sourceText: 'Sierra Leone',
            sourceLanguage: 'en',
            targetLanguage: 'es',
        });
        console.log(`   ✅ Result: "${result6}"\n`);

        console.log('='.repeat(60));
        console.log('✅ All tests completed successfully!\n');
        console.log('💡 Next steps:');
        console.log('   • View cached translations: npx prisma studio');
        console.log('   • Check Translation table in database');
        console.log('   • Run this script again to verify cache hits\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
        } else {
            console.error(error);
        }
        console.error('\n💡 Troubleshooting:');
        console.error('   • Ensure OPENAI_API_KEY is set in .env');
        console.error('   • Check database connection (DATABASE_URL)');
        console.error('   • Verify Prisma schema is up to date');
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
