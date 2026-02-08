export const locales = ['en', 'es', 'fr', 'de', 'it', 'zh'] as const;
export const defaultLocale = 'en' as const;
export type Locale = (typeof locales)[number];
