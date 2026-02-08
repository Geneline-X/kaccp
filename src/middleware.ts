import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

/**
 * Detect locale from various sources
 * Priority: URL > Cookie > Accept-Language header > Default
 */
function detectLocale(request: NextRequest): string {
    // Check cookie
    const localeCookie = request.cookies.get('NEXT_LOCALE');
    if (localeCookie && locales.includes(localeCookie.value as any)) {
        return localeCookie.value;
    }

    // Check Accept-Language header
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
        // Parse Accept-Language header (e.g., "en-US,en;q=0.9,fr;q=0.8")
        const preferredLocales = acceptLanguage
            .split(',')
            .map((lang) => lang.split(';')[0].trim().split('-')[0])
            .filter((lang) => locales.includes(lang as any));

        if (preferredLocales.length > 0) {
            return preferredLocales[0];
        }
    }

    // Default locale
    return defaultLocale;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for API routes, static files, and Next.js internals
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.includes('/favicon.ico') ||
        pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
    ) {
        return NextResponse.next();
    }

    // Check if pathname already has a locale
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) {
        return NextResponse.next();
    }

    // Detect locale and redirect
    const locale = detectLocale(request);
    request.nextUrl.pathname = `/${locale}${pathname}`;

    const response = NextResponse.redirect(request.nextUrl);

    // Set cookie to persist locale preference
    response.cookies.set('NEXT_LOCALE', locale, {
        path: '/',
        maxAge: 31536000, // 1 year
        sameSite: 'lax',
    });

    return response;
}

export const config = {
    matcher: [
        // Match all pathnames except for
        // - … if they start with `/api`, `/_next` or `/_vercel`
        // - … the ones containing a dot (e.g. `favicon.ico`)
        '/((?!api|_next|_vercel|.*\\..*).*)',
    ],
};
