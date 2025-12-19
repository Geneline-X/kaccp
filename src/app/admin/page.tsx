"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect to V2 Dashboard
export default function AdminDashboardPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/admin/v2')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}
