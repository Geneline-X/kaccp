"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function AdminEligibilityPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [rate, setRate] = useState(1.2)
  const [threshold, setThreshold] = useState(30)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      const data = await apiFetch<{ items: any[]; total: number; page: number; pageSize: number; ratePerMinuteSLE: number; thresholdSLE: number }>(`/api/admin/eligibility?${q.toString()}`)
      setItems(data.items || [])
      setTotal(data.total || 0)
      setPage(data.page || page)
      setPageSize(data.pageSize || pageSize)
      setRate(data.ratePerMinuteSLE || 1.2)
      setThreshold(data.thresholdSLE || 30)
    } catch (e: any) {
      setError(e.message || 'Failed to load eligibility')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize])

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Weekly Eligibility"
        description={`Transcribers at or above ${threshold} SLE in the last 7 days`}
        actions={<Button asChild><Link href="/admin/payments">Go to Payments</Link></Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Eligible Transcribers</CardTitle>
          <CardDescription>Rate {rate.toFixed(2)} SLE/min • Threshold {threshold} SLE</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span>Page {page} of {pages}</span>
            <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
            <select className="border rounded px-2 py-1" value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value) || 25)}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : error ? (
            <div className="text-destructive p-3 rounded bg-destructive/10">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground">No eligible users yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Approved min (7d)</TableHead>
                    <TableHead className="text-right">Est. SLE (7d)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <EligibilityRow key={it.userId} it={it} onDone={load} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EligibilityRow({ it, onDone }: { it: any; onDone: () => void }) {
  const [creating, setCreating] = useState(false)
  const [amount, setAmount] = useState(() => (it.weeklyEstimatedSLE || 0).toFixed(2))
  const [reference, setReference] = useState(`Weekly payout`)

  const createPayment = async () => {
    try {
      setCreating(true)
      const amountCents = Math.round((parseFloat(amount || '0') || 0) * 100)
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ userId: it.userId, amountCents, currency: 'SLE', reference, notes: `Eligibility payout (7d)` })
      })
      toast.success('Payment created')
      onDone()
    } catch (e: any) {
      toast.error(e.message || 'Failed to create payment')
    } finally {
      setCreating(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
            {it.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">NA</div>
            )}
          </div>
          <div className="text-sm">{it.displayName || (it.email ? it.email.replace(/@.*/, '') : 'Transcriber')}</div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{it.country || '-'}</TableCell>
      <TableCell className="text-right">{(it.weeklyApprovedMinutes || 0).toFixed(1)}</TableCell>
      <TableCell className="text-right">{(it.weeklyEstimatedSLE || 0).toFixed(2)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Amount</Label>
            <Input className="h-8 w-28" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button size="sm" disabled={creating} onClick={createPayment}>{creating ? 'Creating…' : 'Create Payment'}</Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
