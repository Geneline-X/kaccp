// DeepL API provider
import { TranslationProvider } from './types';

export class DeepLTranslationProvider implements TranslationProvider {
    private apiKey: string;
    private apiUrl: string;

    constructor() {
        this.apiKey = process.env.DEEPL_API_KEY || '';
        // DeepL has free and pro endpoints
        const isFree = process.env.DEEPL_API_FREE === 'true';
        this.apiUrl = isFree
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';

        if (!this.apiKey) {
            console.warn('DEEPL_API_KEY not configured');
        }
    }

    async translate(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('DeepL API key not configured');
        }

        try {
            // DeepL uses uppercase language codes
            const sourceLang = sourceLanguage.toUpperCase();
            const targetLang = targetLanguage.toUpperCase();

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: [text],
                    source_lang: sourceLang,
                    target_lang: targetLang,
                }),
            });

            if (!response.ok) {
                throw new Error(`DeepL API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.translations[0].text;
        } catch (error) {
            console.error('DeepL translation error:', error);
            throw error;
        }
    }
}
