/* First-login onboarding.
 *
 * Accounts are created by admins only. Before a person can use the platform they
 * must, in order:
 *   1. CHANGE_PASSWORD — replace the starting password the admin chose
 *      (any account with mustChangePassword = true, whatever its role).
 *   2. ACCEPT_TERMS    — accept the current Terms of Service and Privacy Policy
 *      (contributor roles only: SPEAKER, TRANSCRIBER).
 *
 * Bump TERMS_VERSION whenever TERMS.md / PRIVACY.md change materially: every
 * contributor whose stored termsVersion differs is asked to accept again.
 */

export const TERMS_VERSION = '2026-11-04'

export type OnboardingStep = 'CHANGE_PASSWORD' | 'ACCEPT_TERMS'

const CONTRIBUTOR_ROLES = ['SPEAKER', 'TRANSCRIBER'] as const

export const MIN_PASSWORD_LENGTH = 8

type OnboardingUser = {
  role: string
  roles?: string[] | null
  mustChangePassword?: boolean | null
  termsVersion?: string | null
}

export function isContributor(user: Pick<OnboardingUser, 'role' | 'roles'>): boolean {
  const all = new Set<string>([user.role, ...(user.roles ?? [])])
  return CONTRIBUTOR_ROLES.some((r) => all.has(r))
}

/** Steps this user still has to complete, in the order they must do them. */
export function pendingOnboardingSteps(user: OnboardingUser): OnboardingStep[] {
  const steps: OnboardingStep[] = []
  if (user.mustChangePassword) steps.push('CHANGE_PASSWORD')
  if (isContributor(user) && user.termsVersion !== TERMS_VERSION) steps.push('ACCEPT_TERMS')
  return steps
}

/**
 * API paths a user with pending onboarding may still call. Everything else is
 * refused server-side until onboarding is complete.
 *  - /api/auth/*        — me, onboarding endpoints, password reset
 *  - /api/v2/account/*  — data export: exercising data rights must not depend
 *                         on first accepting new terms
 */
export function isOnboardingExemptPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/') || pathname.startsWith('/api/v2/account/')
}
