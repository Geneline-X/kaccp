"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/client'
import Link from 'next/link'

interface UserV2 {
  id: string
  email: string
  phone: string | null
  displayName: string | null
  role: 'ADMIN' | 'SPEAKER' | 'TRANSCRIBER' | 'REVIEWER'
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  qualityScore: number
  totalEarningsCents: number
  speaksLanguages: string[]
  writesLanguages: string[]
  totalRecordingsSec: number
  totalTranscriptions: number
  _count?: {
    recordings: number
    transcriptions: number
  }
  approvedRecordingMin?: number
  approvedTranscriptions?: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserV2[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<string>('SPEAKER')
  const [creating, setCreating] = useState(false)

  const token = typeof window !== 'undefined' ? getToken() : null

  const loadUsers = async () => {
    if (!token) {
      router.push('/admin/login')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users?stats=true', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsers(data.items || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) loadUsers()
  }, [token])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, phone, password, displayName, role }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmail('')
      setPhone('')
      setPassword('')
      setDisplayName('')
      setRole('SPEAKER')
      setShowCreateForm(false)
      loadUsers()
    } catch (e: any) {
      alert(e.message || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        u.email.toLowerCase().includes(term) ||
        (u.displayName?.toLowerCase() || '').includes(term) ||
        (u.phone?.toLowerCase() || '').includes(term)
      )
    }
    return true
  })

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'SPEAKER': return 'bg-blue-100 text-blue-800'
      case 'TRANSCRIBER': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/admin/v2" className="text-blue-600 hover:underline text-sm">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">User Management</h1>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showCreateForm ? 'Cancel' : '+ Add User'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-lg font-semibold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="+232..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="SPEAKER">Speaker</option>
                  <option value="TRANSCRIBER">Transcriber</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Email, name, or phone..."
                className="px-3 py-2 border border-gray-300 rounded-lg w-64"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Roles</option>
                <option value="SPEAKER">Speakers</option>
                <option value="TRANSCRIBER">Transcribers</option>
                <option value="REVIEWER">Reviewers</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Users ({filtered.length})
            </h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Languages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stats</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{user.displayName || 'No name'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.phone && <div className="text-sm text-gray-400">{user.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                        {!user.isActive && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.role === 'SPEAKER' && user.speaksLanguages.length > 0 && (
                          <div>Speaks: {user.speaksLanguages.join(', ')}</div>
                        )}
                        {user.role === 'TRANSCRIBER' && user.writesLanguages.length > 0 && (
                          <div>Writes: {user.writesLanguages.join(', ')}</div>
                        )}
                        {user.speaksLanguages.length === 0 && user.writesLanguages.length === 0 && (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {user.role === 'SPEAKER' && (
                          <div>
                            <div>{user._count?.recordings || 0} recordings</div>
                            <div className="text-gray-500">{(user.approvedRecordingMin || 0).toFixed(1)} min approved</div>
                          </div>
                        )}
                        {user.role === 'TRANSCRIBER' && (
                          <div>
                            <div>{user._count?.transcriptions || 0} transcriptions</div>
                            <div className="text-gray-500">{user.approvedTranscriptions || 0} approved</div>
                          </div>
                        )}
                        {user.role === 'ADMIN' && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
