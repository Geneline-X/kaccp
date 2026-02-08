"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/infra/client/client'

export function useRequireAuth() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  useEffect(() => {
    const t = getToken()
    if (!t) {
      router.replace('/admin/login')
    } else {
      setReady(true)
    }
  }, [router])
  return ready
}
