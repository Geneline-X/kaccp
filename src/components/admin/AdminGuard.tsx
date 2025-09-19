"use client"
import { PropsWithChildren } from 'react'
import { useRequireAuth } from '@/lib/useAuth'
import { Loader2 } from 'lucide-react'

export default function AdminGuard({ children }: PropsWithChildren) {
  const ready = useRequireAuth()
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-sky-800">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Checking auth…</span>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
