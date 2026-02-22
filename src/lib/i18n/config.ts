import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE');
  const locale = (localeCookie?.value as Locale) || defaultLocale;

  // Load all message files for the locale
  const [common, admin, speaker, transcriber] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/admin.json`),
    import(`../../messages/${locale}/speaker.json`),
    import(`../../messages/${locale}/transcriber.json`),
  ]);

  return {
    locale,
    messages: {
      ...common.default,
      ...admin.default,
      ...speaker.default,
      ...transcriber.default,
    }
  };
});
