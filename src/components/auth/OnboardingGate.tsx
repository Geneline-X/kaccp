"use client"

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getToken } from '@/lib/infra/client/client'

/* Client-side half of the first-login gate.
 *
 * A signed-in user who still has to change their admin-set password or accept the
 * Terms is sent to /onboarding from any protected page. The server enforces the
 * same rule in getAuthUser(); this just turns the resulting API refusals into a
 * clear next step instead of a broken dashboard.
 *
 * Public pages (home, login, legal, leaderboard, onboarding itself) are skipped.
 * A positive result is remembered per token so navigation does not re-check.
 */

const PROTECTED_SECTIONS = ['speaker', 'transcriber', 'reviewer', 'admin']
let verifiedToken: string | null = null

function isProtected(pathname: string): boolean {
  // /{locale}/{section}/...
  const parts = pathname.split('/').filter(Boolean)
  const section = parts[1]
  if (!section || !PROTECTED_SECTIONS.includes(section)) return false
  if (parts.includes('login') || parts.includes('register')) return false
  return true
}

export default function OnboardingGate({ locale }: { locale: string }) {
  const pathname = usePathname() || ''
  const router = useRouter()

  useEffect(() => {
    if (!isProtected(pathname)) return
    const token = getToken()
    if (!token || token === verifiedToken) return

    let cancelled = false
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (Array.isArray(data.onboarding) && data.onboarding.length > 0) {
          router.replace(`/${locale}/onboarding?next=${encodeURIComponent(pathname)}`)
        } else {
          verifiedToken = token
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname, locale, router])

  return null
}
