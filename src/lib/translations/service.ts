// Public API for translation usage
import { translateText } from '@/lib/translation-providers';
import { TranslationRepository } from './repository';

const repository = new TranslationRepository();

export interface TranslateAdminContentParams {
    entityType: string;
    entityId: string;
    fieldName: string;
    sourceText: string;
    sourceLanguage: string;
    targetLanguage: string;
}

/**
 * Translate admin content with database caching
 * 
 * This function:
 * 1. Returns source text if target language matches source
 * 2. Returns empty string if source text is empty
 * 3. Checks cache for existing translation
 * 4. If not cached, calls translation provider
 * 5. Stores result in cache
 * 6. Returns translated text
 * 
 * @example
 * ```typescript
 * const translated = await translateAdminContent({
 *   entityType: 'country',
 *   entityId: 'cuid123',
 *   fieldName: 'name',
 *   sourceText: 'Sierra Leone',
 *   sourceLanguage: 'en',
 *   targetLanguage: 'fr'
 * });
 * // Returns: "Sierra Leone" (from cache or translation provider)
 * ```
 */
export async function translateAdminContent(
    params: TranslateAdminContentParams
): Promise<string> {
    const {
        entityType,
        entityId,
        fieldName,
        sourceText,
        sourceLanguage,
        targetLanguage,
    } = params;

    // No translation needed if same language
    if (targetLanguage === sourceLanguage) {
        return sourceText;
    }

    // Return empty if no text
    if (!sourceText || sourceText.trim() === '') {
        return sourceText;
    }

    // Check cache
    const cached = await repository.findTranslation({
        entityType,
        entityId,
        fieldName,
        targetLanguage,
    });

    if (cached) {
        console.log(`[Translation Cache HIT] ${entityType}.${fieldName} -> ${targetLanguage}`);
        return cached.translatedText;
    }

    console.log(`[Translation Cache MISS] ${entityType}.${fieldName} -> ${targetLanguage}, calling provider...`);

    // Translate using provider
    const translatedText = await translateText(
        sourceText,
        sourceLanguage,
        targetLanguage
    );

    // Store in cache
    await repository.createTranslation({
        entityType,
        entityId,
        fieldName,
        sourceLanguage,
        targetLanguage,
        sourceText,
        translatedText,
    });

    console.log(`[Translation Cached] ${entityType}.${fieldName} -> ${targetLanguage}`);

    return translatedText;
}
