"use client"
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/client'

type NotificationItem = {
  id: string
  title: string
  body?: string | null
  createdAt: string
}

import { useTranslations, useFormatter } from 'next-intl'

// ... existing code ...

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('notifications')
  const format = useFormatter()

  const load = async (showNewToast = false) => {
    try {
      setLoading(true)
      const data = await apiFetch<{ items: NotificationItem[]; unreadCount: number }>(`/api/notifications?unread=1&limit=20`)
      if (showNewToast && data.items && data.items.length > items.length) {
        toast.success(t('new'))
      }
      setItems(data.items || [])
      setUnread(data.unreadCount || 0)
    } catch {
      // silent during polling
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load(true), 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify({ all: true }) })
      setUnread(0)
      setItems([])
      toast.success(t('cleared'))
    } catch (e: any) {
      toast.error(e.message || t('failed'))
    }
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) {
            try { window.dispatchEvent(new CustomEvent('kaccp_close_menu')) } catch { }
          }
        }}
        aria-label={t('title')}
      >
        🔔 {unread > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">{unread}</span>}
      </Button>
      {open && (
        <div className="absolute mt-2 w-72 sm:w-80 max-w-[85vw] bg-white shadow-lg border rounded-md z-50 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0">
          <div className="flex items-center justify-between p-2 border-b">
            <div className="text-xs sm:text-sm font-medium">{t('title')}</div>
            <Button size="sm" className="text-xs" variant="ghost" onClick={markAllRead} disabled={loading || unread === 0}>{t('markAllRead')}</Button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {items.length === 0 ? (
              <div className="p-3 text-xs sm:text-sm text-muted-foreground">{t('empty')}</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="p-3 border-b last:border-0">
                  <div className="text-sm sm:text-base font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{format.dateTime(new Date(n.createdAt), { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
