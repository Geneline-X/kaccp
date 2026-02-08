"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/infra/client/client'

export function useRequireTranscriberAuth() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  useEffect(() => {
    const t = getToken()
    if (!t) {
      router.replace('/transcriber/login')
    } else {
      ;(async () => {
        try {
          const resp = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` } })
          const json = await resp.json()
          if (!resp.ok) throw new Error(json?.error || 'Unauthorized')
          const role = String(json?.user?.role || '').toUpperCase()
          if (role !== 'TRANSCRIBER') {
            router.replace('/transcriber/login')
            return
          }
          setReady(true)
        } catch {
          router.replace('/transcriber/login')
        }
      })()
    }
  }, [router])
  return ready
}
