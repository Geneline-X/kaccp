"use client"
import { useEffect, useMemo, useState } from 'react'
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
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ users: any[]; payments: PaymentRow[] }>("/api/admin/payments")
      setUsers(res.users)
      setPayments(res.payments)
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

      <CreatePayment users={users} onDone={load} />

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

function CreatePayment({ users, onDone }: { users: any[]; onDone: () => void }) {
  const [userId, setUserId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'USD'|'SLE'>('SLE')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const topCandidates = useMemo(() => users.slice(0, 50), [users])

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
                  <SelectItem key={u.id} value={u.id}>{u.displayName || u.email} · {(u.totalEarningsCents/100).toFixed(2)} SLE</SelectItem>
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
          <div className="md:col-span-3">
            <Button type="submit" disabled={creating || !userId || !amount}>{creating ? 'Creating…' : 'Create Payment'}</Button>
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
