/* Client helpers for first-login onboarding (see lib/domain/users/onboarding.ts). */

/** Where to send a user right after a successful login. */
export function postLoginPath(locale: string, destination: string, onboarding: unknown): string {
  if (Array.isArray(onboarding) && onboarding.length > 0) {
    return `/${locale}/onboarding?next=${encodeURIComponent(destination)}`
  }
  return destination
}

/** Only allow same-site relative paths as a post-onboarding destination. */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
