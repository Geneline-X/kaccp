// Admin translation trigger utilities
import { translateAdminContent } from './service';
import { locales, defaultLocale } from '@/i18n';

/**
 * Configuration for translation triggers
 */
export interface TranslationTriggerConfig {
    entityType: string;
    entityId: string;
    fields: string[];
    sourceLanguage?: string;
    targetLanguages?: string[];
    skipLanguages?: string[];
}

/**
 * Translate admin-created content when it changes
 * 
 * This function pre-generates translations for all enabled languages
 * to ensure UI never waits on translation and costs are controlled.
 * 
 * @example
 * ```typescript
 * // After creating/updating a prompt
 * await triggerAdminTranslation({
 *   entityType: 'prompt',
 *   entityId: prompt.id,
 *   fields: ['text', 'instruction'],
 *   sourceLanguage: 'en',
 * });
 * ```
 */
export async function triggerAdminTranslation(
    config: TranslationTriggerConfig
): Promise<void> {
    const {
        entityType,
        entityId,
        fields,
        sourceLanguage = defaultLocale,
        targetLanguages = locales.filter((l) => l !== sourceLanguage),
        skipLanguages = [],
    } = config;

    const languagesToTranslate = targetLanguages.filter(
        (lang) => !skipLanguages.includes(lang)
    );

    console.log(
        `[Translation Trigger] Starting translation for ${entityType}:${entityId}`,
        {
            fields,
            sourceLanguage,
            targetLanguages: languagesToTranslate,
        }
    );

    // Translate each field to each target language
    const translationPromises: Promise<void>[] = [];

    for (const field of fields) {
        for (const targetLanguage of languagesToTranslate) {
            const promise = (async () => {
                try {
                    // Get the source text (this should be passed in or fetched)
                    // For now, we'll need to fetch it from the entity
                    // This is a placeholder - actual implementation depends on entity type
                    const sourceText = await getEntityFieldValue(entityType, entityId, field);

                    if (!sourceText || sourceText.trim() === '') {
                        console.log(
                            `[Translation Trigger] Skipping empty field ${field} for ${entityType}:${entityId}`
                        );
                        return;
                    }

                    await translateAdminContent({
                        entityType,
                        entityId,
                        fieldName: field,
                        sourceText,
                        sourceLanguage,
                        targetLanguage,
                    });

                    console.log(
                        `[Translation Trigger] ✓ Translated ${field} to ${targetLanguage} for ${entityType}:${entityId}`
                    );
                } catch (error) {
                    console.error(
                        `[Translation Trigger] ✗ Failed to translate ${field} to ${targetLanguage}:`,
                        error
                    );
                    // Don't throw - continue with other translations
                }
            })();

            translationPromises.push(promise);
        }
    }

    // Wait for all translations to complete
    await Promise.all(translationPromises);

    console.log(
        `[Translation Trigger] Completed translation for ${entityType}:${entityId}`
    );
}

/**
 * Helper to get entity field value
 * This should be implemented based on your entity types
 */
async function getEntityFieldValue(
    entityType: string,
    entityId: string,
    field: string
): Promise<string> {
    // This is a placeholder implementation
    // In real usage, you would fetch from Prisma based on entityType
    const { prisma } = await import('@/lib/infra/prisma');

    switch (entityType) {
        case 'prompt':
            const prompt = await prisma.prompt.findUnique({
                where: { id: entityId },
                select: { [field]: true },
            });
            return (prompt as any)?.[field] || '';

        case 'country':
            const country = await prisma.country.findUnique({
                where: { id: entityId },
                select: { [field]: true },
            });
            return (country as any)?.[field] || '';

        case 'language':
            const language = await prisma.language.findUnique({
                where: { id: entityId },
                select: { [field]: true },
            });
            return (language as any)?.[field] || '';

        default:
            throw new Error(`Unknown entity type: ${entityType}`);
    }
}

/**
 * Batch translation for multiple entities
 * Useful for bulk operations or migrations
 */
export async function triggerBatchAdminTranslation(
    configs: TranslationTriggerConfig[]
): Promise<void> {
    console.log(`[Translation Trigger] Starting batch translation for ${configs.length} entities`);

    // Process in batches to avoid overwhelming the translation API
    const batchSize = 5;
    for (let i = 0; i < configs.length; i += batchSize) {
        const batch = configs.slice(i, i + batchSize);
        await Promise.all(batch.map((config) => triggerAdminTranslation(config)));
    }

    console.log(`[Translation Trigger] Completed batch translation`);
}

/**
 * Helper to trigger translation for a single field update
 * Use this in API routes when admin updates content
 */
export async function translateSingleField(
    entityType: string,
    entityId: string,
    field: string,
    sourceText: string,
    sourceLanguage: string = defaultLocale
): Promise<void> {
    const targetLanguages = locales.filter((l) => l !== sourceLanguage);

    await Promise.all(
        targetLanguages.map((targetLanguage) =>
            translateAdminContent({
                entityType,
                entityId,
                fieldName: field,
                sourceText,
                sourceLanguage,
                targetLanguage,
            }).catch((error) => {
                console.error(
                    `Failed to translate ${field} to ${targetLanguage}:`,
                    error
                );
                // Don't throw - allow other translations to continue
            })
        )
    );
}
