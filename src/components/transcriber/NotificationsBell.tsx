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

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async (showNewToast = false) => {
    try {
      setLoading(true)
      const data = await apiFetch<{ items: NotificationItem[]; unreadCount: number }>(`/api/notifications?unread=1&limit=20`)
      if (showNewToast && data.items && data.items.length > items.length) {
        toast.success('You have new notifications')
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
  }, [])

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications', { method: 'POST', body: JSON.stringify({ all: true }) })
      setUnread(0)
      setItems([])
      toast.success('Notifications cleared')
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark as read')
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔 {unread > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-1.5 py-0.5">{unread}</span>}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[80vw] bg-white shadow-lg border rounded-md z-50">
          <div className="flex items-center justify-between p-2 border-b">
            <div className="text-sm font-medium">Notifications</div>
            <Button size="sm" variant="ghost" onClick={markAllRead} disabled={loading || unread === 0}>Mark all read</Button>
          </div>
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No unread notifications</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="p-3 border-b last:border-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
