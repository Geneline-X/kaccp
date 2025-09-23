"use client"
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken } from './client'

export function useRequireAdminAuth() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const t = getToken()
    if (!t) {
      router.replace('/admin/login')
      return
    }
    ;(async () => {
      try {
        const resp = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
        const json = await resp.json()
        if (!resp.ok) throw new Error(json?.error || 'Unauthorized')
        const role = String(json?.user?.role || '').toUpperCase()
        if (role !== 'ADMIN') {
          router.replace('/admin/login')
          return
        }
        setReady(true)
      } catch {
        router.replace('/admin/login')
      }
    })()
  }, [router, pathname])

  return ready
}
