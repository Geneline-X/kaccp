// Translation provider implementations
import { TranslationProvider } from './types';
import { GoogleTranslationProvider } from '@/lib/translation-providers/google';
import { DeepLTranslationProvider } from '@/lib/translation-providers/deepl';
import { OpenAITranslationProvider } from '@/lib/translation-providers/openai';

/**
 * Available translation providers
 * Maps provider names to their instances
 */
const AVAILABLE_PROVIDERS: Record<string, TranslationProvider> = {
    google: new GoogleTranslationProvider(),
    deepl: new DeepLTranslationProvider(),
    openai: new OpenAITranslationProvider(),
};

/**
 * Get the active translation provider based on environment configuration
 * @returns The configured translation provider instance
 * @throws Error if provider is not configured or not found
 */
function getActiveProvider(): TranslationProvider {
    const providerName = process.env.TRANSLATION_PROVIDER || 'google';

    const provider = AVAILABLE_PROVIDERS[providerName.toLowerCase()];

    if (!provider) {
        throw new Error(
            `Translation provider '${providerName}' not found. Available providers: ${Object.keys(AVAILABLE_PROVIDERS).join(', ')}`
        );
    }

    return provider;
}

/**
 * Translate text from source language to target language
 * Uses the configured translation provider from environment variables
 * 
 * @param text - The text to translate
 * @param sourceLanguage - Source language code (e.g., 'en', 'es', 'fr')
 * @param targetLanguage - Target language code (e.g., 'en', 'es', 'fr')
 * @returns The translated text
 * 
 * @example
 * ```typescript
 * const translated = await translateText('Hello', 'en', 'es');
 * console.log(translated); // "Hola"
 * ```
 */
export async function translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
): Promise<string> {
    // Return unchanged if text is empty
    if (!text || text.trim() === '') {
        return text;
    }

    // No translation needed if source and target are the same
    if (sourceLanguage === targetLanguage) {
        return text;
    }

    const provider = getActiveProvider();

    return provider.translate(text, sourceLanguage, targetLanguage);
}

// Export provider classes and interface for direct use if needed
export type { TranslationProvider } from './types';
export { GoogleTranslationProvider } from '@/lib/translation-providers/google';
export { DeepLTranslationProvider } from '@/lib/translation-providers/deepl';
export { OpenAITranslationProvider } from '@/lib/translation-providers/openai';
