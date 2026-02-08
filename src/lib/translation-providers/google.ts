// Google Translate API provider
import { TranslationProvider } from './types';

export class GoogleTranslationProvider implements TranslationProvider {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || '';
        if (!this.apiKey) {
            console.warn('GOOGLE_TRANSLATE_API_KEY not configured');
        }
    }

    async translate(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Google Translate API key not configured');
        }

        try {
            const url = `https://translation.googleapis.com/language/translate/v2`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLanguage,
                    target: targetLanguage,
                    key: this.apiKey,
                    format: 'text',
                }),
            });

            if (!response.ok) {
                throw new Error(`Google Translate API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data.translations[0].translatedText;
        } catch (error) {
            console.error('Google Translate error:', error);
            throw error;
        }
    }
}
