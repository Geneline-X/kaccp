"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { User, UserRole } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastSuccess, toastError } from '@/lib/toast'
import { apiFetch } from '@/lib/client'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type UserWithStats = {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
  _count?: {
    audios?: number
    reviews?: number
  }
  totalEarningsCents?: number
  approvedMinutes?: number
  estimatedSLE?: number
}

export const columns: ColumnDef<UserWithStats>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      const user = row.original as UserWithStats
      return (
        <div className="flex flex-col">
          <span className="font-medium">{user.displayName || user.email}</span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const user = row.original as UserWithStats
      return (
        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
          {user.role}
        </Badge>
      )
    },
  },
  {
    accessorKey: "stats",
    header: "Activity",
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="text-sm space-y-1">
          <div>Audios: {user._count?.audios || 0}</div>
          <div>Reviews: {user._count?.reviews || 0}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "earnings",
    header: "Earnings",
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="font-medium">
          {user.totalEarningsCents ? (user.totalEarningsCents / 100).toFixed(2) : '0.00'} SLE
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Joined",
    cell: ({ row }) => {
      const date = row.original.createdAt
      return <div className="text-sm">{format(date, 'MMM d, yyyy')}</div>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original
      
      const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${user.email}?`)) return
        
        try {
          await apiFetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE',
          })
          toastSuccess('User deleted successfully')
          // You might want to refresh the users list here
          window.location.reload()
        } catch (error: any) {
          toastError('Failed to delete user', error.message)
        }
      }
      
      return (
        <div className="flex space-x-2">
          <ViewUserModalTrigger userId={user.id} label="View" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            Delete
          </Button>
        </div>
      )
    },
  },
]

function ViewUserModalTrigger({ userId, label = 'View' }: { userId: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    user: { id: string; email: string; phone?: string | null; displayName?: string | null; role: string; country?: string | null; avatarUrl?: string | null; createdAt: string; lastLoginAt?: string | null; totalEarningsCents?: number }
    stats: { reviewsCount: number; uploadsCount: number; approvedMinutes: number; statusCounts: Record<string, number> }
    recent: { reviews: any[]; payments: any[] }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch(`/api/admin/users/${userId}`)
      setData(res)
    } catch (e: any) {
      setError(e.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Overview and recent activity</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : error ? (
            <div className="text-destructive p-3 rounded bg-destructive/10 text-sm">{error}</div>
          ) : data ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
                  {data.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">NA</div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{data.user.displayName || data.user.email}</div>
                  <div className="text-xs text-muted-foreground">{data.user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Role" value={data.user.role} />
                <Stat label="Country" value={data.user.country || '—'} />
                <Stat label="Phone" value={data.user.phone || '—'} />
                <Stat label="Approved min" value={data.stats.approvedMinutes.toFixed(1)} />
                <Stat label="Est. SLE" value={(data.stats.approvedMinutes * 1.2).toFixed(2)} />
                <Stat label="Reviews" value={data.stats.reviewsCount} />
                <Stat label="Uploads" value={data.stats.uploadsCount} />
                <Stat label="Earnings" value={`${((data.user.totalEarningsCents||0)/100).toFixed(2)} SLE`} />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Submission states</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(data.stats.statusCounts || {}).map(([k,v]) => (
                    <div key={k} className="border rounded p-2 flex items-center justify-between"><span>{k}</span><span className="font-medium">{v}</span></div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium mb-1">Recent Reviews</div>
                  <div className="border rounded divide-y">
                    {(data.recent.reviews||[]).slice(0,5).map((r:any) => (
                      <div key={r.id} className="p-2 flex items-center justify-between"><span className="text-xs">{r.decision}</span><span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span></div>
                    ))}
                    {(!data.recent.reviews || data.recent.reviews.length===0) && <div className="p-2 text-xs text-muted-foreground">No reviews</div>}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">Recent Payments</div>
                  <div className="border rounded divide-y">
                    {(data.recent.payments||[]).slice(0,5).map((p:any) => (
                      <div key={p.id} className="p-2 flex items-center justify-between"><span className="text-xs">{(p.amountCents/100).toFixed(2)} {p.currency}</span><span className="text-[10px] text-muted-foreground">{p.status}</span></div>
                    ))}
                    {(!data.recent.payments || data.recent.payments.length===0) && <div className="p-2 text-xs text-muted-foreground">No payments</div>}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
