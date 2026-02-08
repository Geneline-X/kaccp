// TranslationFallbackNotice component for displaying fallback warnings
'use client';

export interface TranslationFallbackNoticeProps {
    isFallbackUsed: boolean;
    targetLanguage: string;
    className?: string;
}

/**
 * Optional UX indicator when a translation is missing
 * 
 * Useful in admin dashboards, never shown to contributors.
 * Only renders when a fallback is being used.
 * 
 * @example
 * ```tsx
 * <TranslationFallbackNotice
 *   isFallbackUsed={true}
 *   targetLanguage="fr"
 * />
 * ```
 */
export function TranslationFallbackNotice({
    isFallbackUsed,
    targetLanguage,
    className = '',
}: TranslationFallbackNoticeProps) {
    if (!isFallbackUsed) {
        return null;
    }

    return (
        <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 rounded-md ${className}`}
            role="status"
            aria-live="polite"
        >
            <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
            </svg>
            <span>Not yet translated to {targetLanguage}</span>
        </div>
    );
}

/**
 * Compact inline version for use within text
 */
export function TranslationFallbackNoticeInline({
    isFallbackUsed,
    targetLanguage,
    className = '',
}: TranslationFallbackNoticeProps) {
    if (!isFallbackUsed) {
        return null;
    }

    return (
        <span
            className={`ml-2 text-xs text-yellow-600 dark:text-yellow-400 ${className}`}
            title={`Not yet translated to ${targetLanguage}`}
        >
            ⚠️
        </span>
    );
}
