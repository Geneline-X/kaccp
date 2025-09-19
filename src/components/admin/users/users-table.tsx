"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from 'date-fns'
import { User, UserRole } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toastSuccess, toastError } from '@/lib/toast'
import { apiFetch } from '@/lib/client'

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
          <Button variant="outline" size="sm" asChild>
            <a href={`/admin/users/${user.id}`}>View</a>
          </Button>
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
