"use client"
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { columns, type UserWithStats } from '@/components/admin/users/users-table'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { toastSuccess, toastError } from '@/lib/toast'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'ALL'|'TRANSCRIBER'|'ADMIN'>('ALL')
  const [balanceOnly, setBalanceOnly] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'ADMIN'|'TRANSCRIBER'>('TRANSCRIBER')
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ items: UserWithStats[] }>("/api/admin/users?stats=true")
      // Transform the API response to match our UserWithStats type
      const users = res.items.map(user => ({
        ...user,
        // Ensure dates are Date objects
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt || user.createdAt)
      }))
      setUsers(users)
    } catch (e: any) {
      const errorMsg = e.message || 'Failed to load users'
      setError(errorMsg)
      toastError('Error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    loadUsers() 
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await apiFetch("/api/admin/users", {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName, role })
      })
      
      toastSuccess('User created successfully')
      setEmail('')
      setPassword('')
      setDisplayName('')
      setRole('TRANSCRIBER')
      setShowCreateForm(false)
      await loadUsers()
    } catch (e: any) {
      toastError('Failed to create user', e.message)
    } finally {
      setCreating(false)
    }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
    if (balanceOnly && (u as any).balanceSLE !== undefined) return (u as any).balanceSLE > 0
    return !balanceOnly || (u as any).balanceSLE === undefined
  })

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Users" 
        description="Manage user accounts and permissions"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="TRANSCRIBER">Transcribers</SelectItem>
                  <SelectItem value="ADMIN">Admins</SelectItem>
                </SelectContent>
              </Select>
              <label className="text-sm inline-flex items-center gap-2">
                <input type="checkbox" checked={balanceOnly} onChange={(e) => setBalanceOnly(e.target.checked)} />
                Balance &gt; 0
              </label>
            </div>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cancel' : 'Add User'}
            </Button>
          </div>
        }
      />

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>Add a new user to the system</CardDescription>
          </CardHeader>
          <form onSubmit={handleCreateUser}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(v => !v)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name (Optional)</Label>
                  <Input
                    id="displayName"
                    placeholder="John Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={role} 
                    onValueChange={(value: 'ADMIN' | 'TRANSCRIBER') => setRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRANSCRIBER">Transcriber</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? 's' : ''} in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-destructive p-4 rounded-md bg-destructive/10">
              {error}
            </div>
          ) : (
            <DataTable 
              columns={columns} 
              data={filtered} 
              searchKey="email"
              loading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
