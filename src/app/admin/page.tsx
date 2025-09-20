"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toastError, toastSuccess } from '@/lib/toast'

type DashboardUser = { id: string; email: string; displayName?: string | null; totalEarningsCents: number }
type DashboardPayment = { id: string; amountCents: number; currency: 'USD' | 'SLE'; status: string; createdAt: string }
type DashboardAudio = { id: string; title: string; originalUri: string; status: string; _count?: { chunks?: number }; createdAt?: string }

export default function AdminDashboardPage() {
  const [pendingReviews, setPendingReviews] = useState<number | null>(null)
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [payments, setPayments] = useState<DashboardPayment[]>([])
  const [audios, setAudios] = useState<DashboardAudio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workerHealth, setWorkerHealth] = useState<{ ok: boolean; status?: number; body?: any; error?: string } | null>(null)
  const [workerHealthLoading, setWorkerHealthLoading] = useState(false)
  const [metrics, setMetrics] = useState<{
    totals: { totalSeconds: number; totalMinutes: number; totalHours: number }
    approved: { count: number; seconds: number; minutes: number; hours: number }
    assigned: { count: number; seconds: number; minutes: number; hours: number }
    submitted: { count: number; seconds: number; minutes: number; hours: number }
  } | null>(null)

  const totalUsers = users.length
  const totalEarningsCents = useMemo(() => users.reduce((sum, u) => sum + (u.totalEarningsCents || 0), 0), [users])
  const totalEarningsSLE = (totalEarningsCents / 100).toFixed(2)
  const recentPayments7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return payments.filter(p => new Date(p.createdAt).getTime() >= cutoff).length
  }, [payments])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reviewsRes, paymentsRes, usersRes, audiosRes, metricsRes] = await Promise.all([
        apiFetch<{ items: any[] }>("/api/admin/reviews"),
        apiFetch<{ users: DashboardUser[]; payments: DashboardPayment[] }>("/api/admin/payments"),
        apiFetch<{ items: DashboardUser[] }>("/api/admin/users"),
        apiFetch<{ items: DashboardAudio[] }>("/api/admin/audios"),
        apiFetch<any>("/api/admin/metrics"),
      ])
      setPendingReviews(reviewsRes.items.length)
      setUsers(usersRes.items || paymentsRes.users || [])
      setPayments(paymentsRes.payments || [])
      setAudios((audiosRes.items || []).slice(0, 5))
      setMetrics(metricsRes as any)
    } catch (e: any) {
      const msg = e.message || 'Failed to load dashboard data'
      setError(msg)
      toastError('Dashboard error', msg)
    } finally {
      setLoading(false)
    }
  }

  const runSanitize = async () => {
    try {
      const json = await apiFetch<{ ok: true; fixed: { approved: number; submitted: number; assigned: number; available: number } }>(
        '/api/admin/maintenance/sanitize-chunks',
        { method: 'POST' }
      )
      const f = (json as any)?.fixed || {}
      toastSuccess(`Sanitized: approved=${f.approved||0}, submitted=${f.submitted||0}, assigned=${f.assigned||0}, available=${f.available||0}`)
      // Optionally refresh dashboard metrics
      load()
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('unauthorized')) {
        toastError('Sanitize failed', 'You must be logged in as an admin to run maintenance.')
      } else {
        toastError('Sanitize failed', msg || 'Unknown error')
      }
    }
  }

  const checkWorkerHealth = async () => {
    try {
      setWorkerHealthLoading(true)
      setWorkerHealth(null)
      const res = await fetch('/api/worker-health', { cache: 'no-store' })
      const json = await res.json()
      setWorkerHealth(json)
    } catch (e: any) {
      setWorkerHealth({ ok: false, error: e.message || 'failed to check worker health' })
    } finally {
      setWorkerHealthLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Dashboard"
        description="Overview of system activity and performance"
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={runSanitize}>Sanitize Chunks</Button>
            <Button asChild variant="secondary"><Link href="/admin/approved">Approved Data</Link></Button>
            <Button asChild><Link href="/admin/export">Export Dataset</Link></Button>
          </div>
        )}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending Reviews</CardTitle>
            <CardDescription>Awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReviews ?? (loading ? '…' : 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
            <CardDescription>Active accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '…' : totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Earnings</CardTitle>
            <CardDescription>All-time SLE</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '…' : `${totalEarningsSLE} SLE`}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Recent Payments</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? '…' : recentPayments7d}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Audio</CardTitle>
            <CardDescription>All chunks (hours)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{!metrics ? '…' : metrics.totals.totalHours.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{!metrics ? '' : `${metrics.totals.totalMinutes.toFixed(1)} minutes`}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Approved</CardTitle>
            <CardDescription>Reviewed hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{!metrics ? '…' : metrics.approved.hours.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{!metrics ? '' : `${metrics.approved.minutes.toFixed(1)} minutes`}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Submitted</CardTitle>
            <CardDescription>Pending + reviewed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{!metrics ? '…' : metrics.submitted.hours.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{!metrics ? '' : `${metrics.submitted.minutes.toFixed(1)} minutes`}</div>
          </CardContent>
        </Card>
      </div>

      {/* Worker Health */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Health</CardTitle>
          <CardDescription>Check the Python worker status</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={checkWorkerHealth} disabled={workerHealthLoading}>
            {workerHealthLoading ? 'Checking…' : 'Check Worker Health'}
          </Button>
          {workerHealth && (
            <div className="text-sm text-muted-foreground break-all">
              {workerHealth.ok ? (
                <span className="text-green-600">OK</span>
              ) : (
                <span className="text-red-600">Unavailable</span>
              )}
              {typeof workerHealth.status !== 'undefined' && (
                <span className="ml-2">status: {workerHealth.status}</span>
              )}
              {workerHealth.error && (
                <span className="ml-2">error: {workerHealth.error}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Audios</CardTitle>
            <CardDescription>Latest sources and status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : audios.length === 0 ? (
              <div className="text-muted-foreground">No audios yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Chunks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audios.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium line-clamp-1">{a.title}</div>
                        <div className="text-xs text-muted-foreground break-all line-clamp-1">{a.originalUri}</div>
                      </TableCell>
                      <TableCell className="text-sm">{a.status}</TableCell>
                      <TableCell className="text-sm">{a._count?.chunks ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payouts</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-muted-foreground">No payments yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 5).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{(p.amountCents/100).toFixed(2)} {p.currency}</TableCell>
                      <TableCell className="text-sm">{p.status}</TableCell>
                      <TableCell className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
