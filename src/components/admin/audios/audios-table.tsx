"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export type AudioRow = {
  id: string
  title: string
  originalUri: string
  status: string
  createdAt?: string | Date
  _count?: { chunks?: number }
}

import { useTranslations, useFormatter } from 'next-intl'

export function useAudioColumns(): ColumnDef<AudioRow>[] {
  const t = useTranslations('admin.tables.audios')
  const format = useFormatter()

  return [
    {
      accessorKey: 'title',
      header: t('title'),
      cell: ({ row }) => {
        const a = row.original
        return (
          <div className="flex flex-col">
            <span className="font-medium line-clamp-1">{a.title}</span>
            <span className="text-xs text-muted-foreground break-all line-clamp-1">{a.originalUri}</span>
          </div>
        )
      }
    },
    {
      accessorKey: 'status',
      header: t('status'),
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>
    },
    {
      accessorKey: 'chunks',
      header: t('chunks'),
      cell: ({ row }) => (row.original._count?.chunks ?? 0).toString(),
    },
    {
      accessorKey: 'createdAt',
      header: t('created'),
      cell: ({ row }) => {
        const v = row.original.createdAt
        if (!v) return '-'
        const date = typeof v === 'string' ? new Date(v) : v
        return <span className="text-sm">{format.dateTime(date, { dateStyle: 'long' })}</span>
      },
    },
  ]
}
