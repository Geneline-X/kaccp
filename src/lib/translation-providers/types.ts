/**
 * TranslationProvider interface
 * All translation providers must implement this interface
 */
export interface TranslationProvider {
    translate(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string>;
}
