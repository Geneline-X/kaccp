// Translation resolver - safe, read-only text lookup
import { TranslationRepository } from './repository';

const repository = new TranslationRepository();

export interface ResolveTranslatedTextParams {
    entityType: string;
    entityId: string;
    field: string;
    originalText: string;
    requestedLanguage: string;
    defaultLanguage: string;
}

export interface ResolveTranslatedTextResult {
    text: string;
    isFallback: boolean;
    source: 'original' | 'translation' | 'fallback';
}

/**
 * Safely resolve translated text at runtime
 * 
 * This function:
 * - Never translates (read-only)
 * - Never calls translation providers
 * - Only reads cached translations from database
 * - Always returns usable text (never throws)
 * - Degrades gracefully to fallbacks
 * 
 * Guarantees:
 * ✅ UI never breaks
 * ✅ No runtime API calls
 * ✅ Missing translations degrade gracefully
 * 
 * @example
 * ```typescript
 * const result = await resolveTranslatedText({
 *   entityType: 'prompt',
 *   entityId: 'prompt-123',
 *   field: 'text',
 *   originalText: 'Hello world',
 *   requestedLanguage: 'fr',
 *   defaultLanguage: 'en'
 * });
 * // Returns: { text: 'Bonjour le monde', isFallback: false, source: 'translation' }
 * ```
 */
export async function resolveTranslatedText(
    params: ResolveTranslatedTextParams
): Promise<ResolveTranslatedTextResult> {
    const {
        entityType,
        entityId,
        field,
        originalText,
        requestedLanguage,
        defaultLanguage,
    } = params;

    // Return original if empty
    if (!originalText || originalText.trim() === '') {
        return {
            text: originalText,
            isFallback: false,
            source: 'original',
        };
    }

    // Return original if requested language is default
    if (requestedLanguage === defaultLanguage) {
        return {
            text: originalText,
            isFallback: false,
            source: 'original',
        };
    }

    try {
        // Try to find translation for requested language
        const translation = await repository.findTranslation({
            entityType,
            entityId,
            fieldName: field,
            targetLanguage: requestedLanguage,
        });

        if (translation) {
            return {
                text: translation.translatedText,
                isFallback: false,
                source: 'translation',
            };
        }

        // Try to find fallback translation (default language)
        const fallback = await repository.findTranslation({
            entityType,
            entityId,
            fieldName: field,
            targetLanguage: defaultLanguage,
        });

        if (fallback) {
            return {
                text: fallback.translatedText,
                isFallback: true,
                source: 'fallback',
            };
        }

        // Return original text as last resort
        return {
            text: originalText,
            isFallback: true,
            source: 'original',
        };
    } catch (error) {
        // Never throw - always return something usable
        console.error('[Translation Resolver Error]', error);
        return {
            text: originalText,
            isFallback: true,
            source: 'original',
        };
    }
}

/**
 * Synchronous version for client components (requires pre-fetched data)
 * Use this when you've already fetched translations and want to resolve client-side
 */
export function resolveTranslatedTextSync(
    params: ResolveTranslatedTextParams & {
        cachedTranslations?: Map<string, string>;
    }
): ResolveTranslatedTextResult {
    const {
        originalText,
        requestedLanguage,
        defaultLanguage,
        cachedTranslations,
    } = params;

    // Return original if empty
    if (!originalText || originalText.trim() === '') {
        return {
            text: originalText,
            isFallback: false,
            source: 'original',
        };
    }

    // Return original if requested language is default
    if (requestedLanguage === defaultLanguage) {
        return {
            text: originalText,
            isFallback: false,
            source: 'original',
        };
    }

    // Check cached translations
    if (cachedTranslations) {
        const key = `${params.entityType}:${params.entityId}:${params.field}:${requestedLanguage}`;
        const translation = cachedTranslations.get(key);

        if (translation) {
            return {
                text: translation,
                isFallback: false,
                source: 'translation',
            };
        }

        // Check fallback
        const fallbackKey = `${params.entityType}:${params.entityId}:${params.field}:${defaultLanguage}`;
        const fallback = cachedTranslations.get(fallbackKey);

        if (fallback) {
            return {
                text: fallback,
                isFallback: true,
                source: 'fallback',
            };
        }
    }

    // Return original as fallback
    return {
        text: originalText,
        isFallback: true,
        source: 'original',
    };
}
