"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/client'
import { toastError, toastSuccess } from '@/lib/toast'

export type PaymentRow = {
  id: string
  userId: string
  amountCents: number
  currency: 'USD' | 'SLE'
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED'
  reference?: string | null
  notes?: string | null
  createdAt: string | Date
}

export function amountToString(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export const paymentColumns = (onDone?: () => void): ColumnDef<PaymentRow>[] => [
  {
    accessorKey: 'amountCents',
    header: 'Amount',
    cell: ({ row }) => {
      const p = row.original
      return <span className="font-medium">{amountToString(p.amountCents, p.currency)}</span>
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status
      const variant = s === 'PAID' ? 'default' : s === 'FAILED' ? 'destructive' : 'secondary'
      return <Badge variant={variant as any}>{s}</Badge>
    }
  },
  {
    accessorKey: 'reference',
    header: 'Reference',
    cell: ({ row }) => row.original.reference || '-'
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => {
      const v = row.original.createdAt
      const d = typeof v === 'string' ? new Date(v) : v
      return <span className="text-sm">{format(d, 'MMM d, yyyy h:mm a')}</span>
    }
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const p = row.original
      const disabled = p.status !== 'PENDING'

      const act = async (action: 'MARK_PAID' | 'MARK_FAILED') => {
        try {
          await apiFetch(`/api/admin/payments/${p.id}`, {
            method: 'POST',
            body: JSON.stringify({ action })
          })
          toastSuccess(action === 'MARK_PAID' ? 'Payment marked as paid' : 'Payment marked as failed')
          onDone?.()
        } catch (e: any) {
          toastError('Payment action failed', e.message)
        }
      }

      return (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => act('MARK_FAILED')}>Mark Failed</Button>
          <Button size="sm" disabled={disabled} onClick={() => act('MARK_PAID')}>Mark Paid</Button>
        </div>
      )
    }
  }
]
