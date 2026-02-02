'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
] as const;

export type LocaleCode = (typeof languages)[number]['code'];

interface LanguageSwitcherProps {
    currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const currentLanguage = languages.find(l => l.code === currentLocale) || languages[0];

    const handleLanguageChange = (locale: string) => {
        // Set the cookie
        document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;

        // Refresh the page to apply the new locale
        startTransition(() => {
            router.refresh();
        });
    };

    return (
        <div className="relative inline-block">
            <div className="group">
                <button
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
                    disabled={isPending}
                >
                    <span>{currentLanguage.flag}</span>
                    <span>{currentLanguage.name}</span>
                    <svg
                        className={`w-4 h-4 transition-transform ${isPending ? 'animate-spin' : 'group-hover:rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {isPending ? (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                    </svg>
                </button>

                <div className="absolute bottom-full left-0 mb-2 w-40 bg-gray-800 rounded-lg shadow-lg border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${lang.code === currentLocale ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300'
                                }`}
                            disabled={isPending}
                        >
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                            {lang.code === currentLocale && (
                                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export { languages };
