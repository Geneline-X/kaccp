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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTranslations, useFormatter } from 'next-intl'

export type UserWithStats = {
  id: string
  email: string
  displayName: string | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
  isActive?: boolean
  phone?: string | null
  _count?: {
    audios?: number
    reviews?: number
  }
  approvedMinutes?: number
  estimatedSLE?: number
  paidSLE?: number
  balanceSLE?: number
}

export function useUserColumns(): ColumnDef<UserWithStats>[] {
  const t = useTranslations('admin.tables.users')
  const format = useFormatter()

  return [
    {
      accessorKey: "email",
      header: t('email'),
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
      header: t('role'),
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
      header: t('activity'),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm space-y-1">
            {user.role === 'TRANSCRIBER' ? (
              <>
                <div>{t('stats.approvedMin', { value: (user.approvedMinutes ?? 0).toFixed(1) })}</div>
                {!!(user._count?.audios || 0) && <div>{t('stats.audios', { value: user._count?.audios || 0 })}</div>}
              </>
            ) : (
              <div>{t('stats.reviews', { value: user._count?.reviews || 0 })}</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "earnings",
      header: t('earnings'),
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="text-sm space-y-0.5">
            <div>{t('stats.est', { value: (user.estimatedSLE ?? 0).toFixed(2) })}</div>
            <div className="text-muted-foreground">{t('stats.paid', { value: (user.paidSLE ?? 0).toFixed(2) })}</div>
            <div className="font-medium">{t('stats.balance', { value: (user.balanceSLE ?? 0).toFixed(2) })}</div>
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: t('joined'),
      cell: ({ row }) => {
        const date = row.original.createdAt
        return <div className="text-sm">{format.dateTime(date, { dateStyle: 'long' })}</div>
      },
    },
    {
      id: "actions",
      header: t('actions'),
      cell: ({ row }) => {
        const user = row.original
        return <UserActionsCell user={user} />
      },
    },
  ]
}

// Extract the actions cell into a proper component to avoid hooks rules violation
function UserActionsCell({ user }: { user: UserWithStats }) {
  const [openRole, setOpenRole] = useState(false)
  const [openDeactivate, setOpenDeactivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('admin.tables.users')

  const submitRoleChange = async (nextRole: 'ADMIN' | 'TRANSCRIBER') => {
    try {
      setLoading(true)
      await apiFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: nextRole }) })
      toastSuccess(t('roleDialog.success', { role: nextRole }))
      window.location.reload()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      toastError(t('roleDialog.failed'), errorMessage)
    } finally {
      setLoading(false)
      setOpenRole(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      setLoading(true)
      await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      toastSuccess(t('deactivateDialog.success'))
      window.location.reload()
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      toastError(t('deactivateDialog.failed'), errorMessage)
    } finally {
      setLoading(false)
      setOpenDeactivate(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">{t('actions')}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <button onClick={() => (document.querySelector(`#view-user-${user.id}-btn`) as HTMLButtonElement)?.click()} className="w-full text-left">{t('view')}</button>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/admin/payments?userId=${user.id}`}>{t('pay')}</a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenRole(true)}>{t('changeRole')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDeactivate(true)} className="text-destructive focus:text-destructive">{user.isActive === false ? t('inactive') : t('deactivate')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Hidden View trigger to reuse the existing modal */}
      <ViewUserModalTrigger userId={user.id} label={<span id={`view-user-${user.id}-btn`} className="sr-only">{t('view')}</span> as React.ReactNode} />

      {/* Change Role Dialog */}
      <Dialog open={openRole} onOpenChange={setOpenRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('roleDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('roleDialog.description', { user: user.displayName || user.email })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button disabled={loading || user.role === 'TRANSCRIBER'} onClick={() => submitRoleChange('TRANSCRIBER')}>{t('roleDialog.makeTranscriber')}</Button>
            <Button disabled={loading || user.role === 'ADMIN'} onClick={() => submitRoleChange('ADMIN')}>{t('roleDialog.makeAdmin')}</Button>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenRole(false)}>{t('roleDialog.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={openDeactivate} onOpenChange={setOpenDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deactivateDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deactivateDialog.description', { user: user.displayName || user.email })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenDeactivate(false)}>{t('deactivateDialog.cancel')}</Button>
            <Button variant="destructive" disabled={loading} onClick={handleDeactivate}>{loading ? t('deactivateDialog.working') : t('deactivateDialog.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ViewUserModalTrigger({ userId, label = 'View' }: { userId: string; label?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('admin.tables.users.details')
  const format = useFormatter()
  const [data, setData] = useState<{
    user: { id: string; email: string; phone?: string | null; displayName?: string | null; role: string; country?: string | null; avatarUrl?: string | null; createdAt: string; lastLoginAt?: string | null; totalEarningsCents?: number }
    stats: { reviewsCount: number; uploadsCount: number; approvedMinutes: number; statusCounts: Record<string, number> }
    recent: { reviews: unknown[]; payments: unknown[] }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiFetch<{
        user: { id: string; email: string; phone?: string | null; displayName?: string | null; role: string; country?: string | null; avatarUrl?: string | null; createdAt: string; lastLoginAt?: string | null; totalEarningsCents?: number }
        stats: { reviewsCount: number; uploadsCount: number; approvedMinutes: number; statusCounts: Record<string, number> }
        recent: { reviews: unknown[]; payments: unknown[] }
      }>(`/api/admin/users/${userId}`)
      setData(res)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load user'
      setError(errorMessage)
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
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('overview')}</DialogDescription>
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
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{t('na')}</div>
                  )}
                </div>
                <div>
                  <div className="font-medium">{data.user.displayName || data.user.email}</div>
                  <div className="text-xs text-muted-foreground">{data.user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Role" value={data.user.role} />
                <Stat label={t('country')} value={data.user.country || '—'} />
                <Stat label={t('phone')} value={data.user.phone || '—'} />
                <Stat label={t('approvedMin')} value={data.stats.approvedMinutes.toFixed(1)} />
                <Stat label={t('estSle')} value={(data.stats.approvedMinutes * 1.2).toFixed(2)} />
                <Stat label={t('reviews')} value={data.stats.reviewsCount} />
                <Stat label={t('uploads')} value={data.stats.uploadsCount} />
                <Stat label={t('earnings')} value={`${((data.user.totalEarningsCents || 0) / 100).toFixed(2)} SLE`} />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">{t('submissionStates')}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(data.stats.statusCounts || {}).map(([k, v]) => (
                    <div key={k} className="border rounded p-2 flex items-center justify-between"><span>{k}</span><span className="font-medium">{v}</span></div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium mb-1">{t('recentReviews')}</div>
                  <div className="border rounded divide-y">
                    {(data.recent.reviews || []).slice(0, 5).map((r) => {
                      const review = r as Record<string, unknown>
                      return <div key={review.id as string} className="p-2 flex items-center justify-between"><span className="text-xs">{review.decision as string}</span><span className="text-[10px] text-muted-foreground">{format.dateTime(new Date(review.createdAt as string), { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                    })}
                    {(!data.recent.reviews || data.recent.reviews.length === 0) && <div className="p-2 text-xs text-muted-foreground">{t('noReviews')}</div>}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">{t('recentPayments')}</div>
                  <div className="border rounded divide-y">
                    {(data.recent.payments || []).slice(0, 5).map((p) => {
                      const payment = p as Record<string, unknown>
                      return <div key={payment.id as string} className="p-2 flex items-center justify-between"><span className="text-xs">{((payment.amountCents as number) / 100).toFixed(2)} {payment.currency as string}</span><span className="text-[10px] text-muted-foreground">{payment.status as string}</span></div>
                    })}
                    {(!data.recent.payments || data.recent.payments.length === 0) && <div className="p-2 text-xs text-muted-foreground">{t('noPayments')}</div>}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>{t('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  )
}
