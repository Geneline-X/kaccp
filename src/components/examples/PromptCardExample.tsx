// Example: Using TranslatedText in a component
import { TranslatedText } from '@/components/i18n/TranslatedText';
import { TranslationFallbackNotice } from '@/components/i18n/TranslationFallbackNotice';
import { resolveTranslatedText } from '@/lib/translations/resolver';

interface PromptCardProps {
    prompt: {
        id: string;
        englishText: string;
        instruction: string | null;
    };
    locale: string;
}

/**
 * Example component showing how to use TranslatedText
 * This is a server component that fetches translations
 */
export async function PromptCard({ prompt, locale }: PromptCardProps) {
    // For more complex scenarios, you can resolve translations manually
    const instructionResult = prompt.instruction
        ? await resolveTranslatedText({
            entityType: 'prompt',
            entityId: prompt.id,
            field: 'instruction',
            originalText: prompt.instruction,
            requestedLanguage: locale,
            defaultLanguage: 'en',
        })
        : null;

    return (
        <div className="p-4 border rounded-lg">
            {/* Simple usage with TranslatedText component */}
            <h3 className="text-lg font-semibold mb-2">
                <TranslatedText
                    entityType="prompt"
                    entityId={prompt.id}
                    field="englishText"
                    originalText={prompt.englishText}
                    locale={locale}
                    fallbackLocale="en"
                />
            </h3>

            {/* Manual resolution with fallback notice */}
            {instructionResult && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p>{instructionResult.text}</p>
                    <TranslationFallbackNotice
                        isFallbackUsed={instructionResult.isFallback}
                        targetLanguage={locale}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Example client component using TranslatedTextClient
 */
'use client';
import { TranslatedTextClient } from '@/components/i18n/TranslatedText';
import { useState } from 'react';

interface PromptCardClientProps {
    prompt: {
        id: string;
        englishText: string;
    };
    initialLocale: string;
    cachedTranslations?: Map<string, string>;
}

export function PromptCardClient({
    prompt,
    initialLocale,
    cachedTranslations,
}: PromptCardClientProps) {
    const [locale, setLocale] = useState(initialLocale);

    return (
        <div className="p-4 border rounded-lg">
            <TranslatedTextClient
                entityType="prompt"
                entityId={prompt.id}
                field="englishText"
                originalText={prompt.englishText}
                locale={locale}
                fallbackLocale="en"
                as="h3"
                className="text-lg font-semibold"
                showFallbackNotice
                cachedTranslations={cachedTranslations}
            />
        </div>
    );
}
