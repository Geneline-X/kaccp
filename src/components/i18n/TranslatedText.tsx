// TranslatedText component for displaying translated content
import { resolveTranslatedText } from '@/lib/translations/resolver';

export interface TranslatedTextProps {
    entityType: string;
    entityId: string;
    field: string;
    originalText: string;
    locale: string;
    fallbackLocale?: string;
    className?: string;
    as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    showFallbackNotice?: boolean;
}

/**
 * Declarative UI wrapper for translated admin content
 * 
 * Components should never know about repositories or services.
 * This component handles translation resolution and rendering.
 * 
 * @example
 * ```tsx
 * <TranslatedText
 *   entityType="prompt"
 *   entityId={prompt.id}
 *   field="text"
 *   originalText={prompt.text}
 *   locale={currentLocale}
 *   fallbackLocale="en"
 * />
 * ```
 */
export async function TranslatedText({
    entityType,
    entityId,
    field,
    originalText,
    locale,
    fallbackLocale = 'en',
    className,
    as: Component = 'span',
    showFallbackNotice = false,
}: TranslatedTextProps) {
    const result = await resolveTranslatedText({
        entityType,
        entityId,
        field,
        originalText,
        requestedLanguage: locale,
        defaultLanguage: fallbackLocale,
    });

    return (
        <>
            <Component className={className}>{result.text}</Component>
            {showFallbackNotice && result.isFallback && (
                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                    (Not yet translated to {locale})
                </span>
            )}
        </>
    );
}

/**
 * Client-side version for use in client components
 * Requires translations to be pre-fetched
 */
'use client';
import { resolveTranslatedTextSync } from '@/lib/translations/resolver';
import { useMemo } from 'react';

export interface TranslatedTextClientProps extends Omit<TranslatedTextProps, 'as'> {
    cachedTranslations?: Map<string, string>;
    as?: React.ElementType;
}

export function TranslatedTextClient({
    entityType,
    entityId,
    field,
    originalText,
    locale,
    fallbackLocale = 'en',
    className,
    as: Component = 'span',
    showFallbackNotice = false,
    cachedTranslations,
}: TranslatedTextClientProps) {
    const result = useMemo(
        () =>
            resolveTranslatedTextSync({
                entityType,
                entityId,
                field,
                originalText,
                requestedLanguage: locale,
                defaultLanguage: fallbackLocale,
                cachedTranslations,
            }),
        [entityType, entityId, field, originalText, locale, fallbackLocale, cachedTranslations]
    );

    return (
        <>
            <Component className={className}>{result.text}</Component>
            {showFallbackNotice && result.isFallback && (
                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                    (Not yet translated to {locale})
                </span>
            )}
        </>
    );
}
