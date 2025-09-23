"use client"
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { DataTable } from '@/components/ui/data-table'
import { paymentColumns, type PaymentRow } from '@/components/admin/payments/payments-table'
import { toastError, toastSuccess } from '@/lib/toast'

export default function AdminPaymentsPage() {
  const [usersBasic, setUsersBasic] = useState<any[]>([])
  const [usersStats, setUsersStats] = useState<any[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [payRes, statsRes] = await Promise.all([
        apiFetch<{ users: any[]; payments: PaymentRow[] }>("/api/admin/payments"),
        apiFetch<{ items: any[] }>("/api/admin/users?stats=true"),
      ])
      setUsersBasic(payRes.users)
      setPayments(payRes.payments)
      setUsersStats(statsRes.items || [])
    } catch (e: any) {
      const msg = e.message || 'Failed to load payments'
      setError(msg)
      toastError('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Payments" 
        description="Create payout records and manage their status"
      />

      <CreatePayment usersBasic={usersBasic} usersStats={usersStats} onDone={load} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
          <CardDescription>{payments.length} payment{payments.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-destructive p-4 rounded-md bg-destructive/10">{error}</div>
          ) : (
            <DataTable 
              columns={paymentColumns(load)}
              data={payments}
              searchKey="reference"
              loading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CreatePayment({ usersBasic, usersStats, onDone }: { usersBasic: any[]; usersStats: any[]; onDone: () => void }) {
  const params = useSearchParams()
  const [userId, setUserId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'USD'|'SLE'>('SLE')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // Merge stats into basic users for richer labels
  const users = useMemo(() => {
    const byId: Record<string, any> = {}
    for (const u of usersStats) byId[u.id] = u
    return (usersBasic || []).map(u => ({
      ...u,
      estimatedSLE: byId[u.id]?.estimatedSLE ?? null,
      paidSLE: byId[u.id]?.paidSLE ?? null,
      balanceSLE: byId[u.id]?.balanceSLE ?? null,
    }))
  }, [usersBasic, usersStats])

  const topCandidates = useMemo(() => users.slice(0, 200), [users])

  // Preselect user from query and default amount to Balance
  useEffect(() => {
    const uid = params?.get('userId')
    if (uid && users.some(u => u.id === uid)) {
      setUserId(uid)
    }
  }, [params, users])

  useEffect(() => {
    const u = users.find(x => x.id === userId)
    if (u && typeof u.balanceSLE === 'number') {
      setAmount(u.balanceSLE > 0 ? u.balanceSLE.toFixed(2) : '')
    }
  }, [userId, users])

  const selectedUser = users.find(u => u.id === userId)
  const balance = typeof selectedUser?.balanceSLE === 'number' ? selectedUser.balanceSLE : null
  const est = typeof selectedUser?.estimatedSLE === 'number' ? selectedUser.estimatedSLE : null
  const paid = typeof selectedUser?.paidSLE === 'number' ? selectedUser.paidSLE : null
  const amountNumber = parseFloat(amount || '0') || 0
  const payoutThresholdSLE = 30
  const belowThreshold = currency === 'SLE' && amountNumber > 0 && amountNumber < payoutThresholdSLE

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const amountCents = Math.round((parseFloat(amount || '0') || 0) * 100)
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ userId, amountCents, currency, reference: reference || undefined, notes: notes || undefined })
      })
      toastSuccess('Payment created')
      setUserId(''); setAmount(''); setReference(''); setNotes('')
      onDone()
    } catch (e: any) {
      toastError('Failed to create payment', e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Payment</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {topCandidates.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {(u.displayName || u.email)} · {(typeof u.balanceSLE === 'number' ? u.balanceSLE.toFixed(2) : ((u.totalEarningsCents||0)/100).toFixed(2))} SLE
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SLE">SLE</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Reference (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {selectedUser && (
            <div className="md:col-span-3 border rounded p-3 text-sm">
              <div className="font-medium mb-1">{selectedUser.displayName || selectedUser.email}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><div className="text-[10px] text-muted-foreground">Estimated</div><div className="font-medium">{est !== null ? est.toFixed(2) : '—'} SLE</div></div>
                <div><div className="text-[10px] text-muted-foreground">Paid</div><div className="font-medium">{paid !== null ? paid.toFixed(2) : '—'} SLE</div></div>
                <div><div className="text-[10px] text-muted-foreground">Balance</div><div className="font-medium">{balance !== null ? balance.toFixed(2) : '—'} SLE</div></div>
                <div><div className="text-[10px] text-muted-foreground">Threshold</div><div className="font-medium">30.00 SLE</div></div>
              </div>
              {currency === 'SLE' && (balance ?? 0) < 30 && (
                <div className="mt-2 text-xs text-amber-600">Balance is below payout threshold. Consider waiting until it reaches 30 SLE.</div>
              )}
              {belowThreshold && (
                <div className="mt-1 text-xs text-amber-600">Entered amount is below the 30 SLE threshold.</div>
              )}
            </div>
          )}
          <div className="md:col-span-3">
            <Button type="submit" disabled={creating || !userId || !amount || (currency==='SLE' && (amountNumber<=0 || amountNumber < payoutThresholdSLE))}>{creating ? 'Creating…' : 'Create Payment'}</Button>
            {currency==='SLE' && amount && amountNumber < payoutThresholdSLE && (
              <span className="ml-2 text-xs text-amber-600">Minimum payout is 30 SLE.</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PaymentRow({ p, onDone }: { p: any; onDone: () => void }) {
  const [acting, setActing] = useState<'MARK_PAID' | 'MARK_FAILED' | null>(null)

  const act = async (action: 'MARK_PAID' | 'MARK_FAILED') => {
    setActing(action)
    try {
      await apiFetch(`/api/admin/payments/${p.id}`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })
      onDone()
    } catch (e: any) {
      alert(e.message || 'Action failed')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="border rounded p-3 flex items-center justify-between gap-3">
      <div>
        <div className="font-medium">{(p.amountCents/100).toFixed(2)} {p.currency}</div>
        <div className="text-xs text-muted-foreground">{p.status} · {new Date(p.createdAt).toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={acting !== null || p.status !== 'PENDING'} onClick={() => act('MARK_FAILED')}>Mark Failed</Button>
        <Button disabled={acting !== null || p.status !== 'PENDING'} onClick={() => act('MARK_PAID')}>{acting === 'MARK_PAID' ? 'Processing…' : 'Mark Paid'}</Button>
      </div>
    </div>
  )
}
