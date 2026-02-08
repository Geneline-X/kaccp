// OpenAI API provider for translations
import OpenAI from 'openai';
import { TranslationProvider } from './types';

export class OpenAITranslationProvider implements TranslationProvider {
    private client: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY || '';
        if (!apiKey) {
            console.warn('OPENAI_API_KEY not configured');
        }
        this.client = new OpenAI({
            apiKey: apiKey || 'mock-key',
        });
    }

    async translate(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const response = await this.client.chat.completions.create({
                model: 'gpt-4o-mini', // More cost-effective for translations
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve the original meaning, tone, and formatting. Return only the translated text without any explanations or additional commentary.`,
                    },
                    {
                        role: 'user',
                        content: text,
                    },
                ],
                temperature: 0.3, // Lower temperature for more consistent translations
            });

            const translatedText = response.choices[0].message.content;
            if (!translatedText) {
                throw new Error('No translation returned from OpenAI');
            }

            return translatedText.trim();
        } catch (error) {
            console.error('OpenAI translation error:', error);
            throw error;
        }
    }
}
