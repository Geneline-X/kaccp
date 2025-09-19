"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from './client'

export function useRequireTranscriberAuth() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  useEffect(() => {
    const t = getToken()
    if (!t) {
      router.replace('/transcriber/login')
    } else {
      setReady(true)
    }
  }, [router])
  return ready
}
