"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetch } from '@/lib/client'

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>()
  const userId = params?.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ user: any; stats: any; recent: any }>(`/api/admin/users/${userId}`)
      setData(res)
    } catch (e: any) {
      setError(e?.message || 'Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!userId) return null

  return (
    <div className="space-y-6">
      <AdminHeader 
        title={data?.user?.displayName || data?.user?.email || 'User Details'} 
        description={data?.user?.email}
      />

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-destructive p-4 rounded-md bg-destructive/10">{error}</div>
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Primary details for payments and communication</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Email</div>
                <div>{data.user.email}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div>{data.user.phone || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Country</div>
                <div>{data.user.country || '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Role</div>
                <div>{data.user.role}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Joined</div>
                <div>{new Date(data.user.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last login</div>
                <div>{data.user.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Quality score</div>
                <div>{(data.user.qualityScore ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Earnings</div>
                <div>{((data.user.totalEarningsCents ?? 0)/100).toFixed(2)} SLE</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Last 10 payout records</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recent?.payments?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{(p.amountCents/100).toFixed(2)} {p.currency}</TableCell>
                          <TableCell className="text-sm">{p.status}</TableCell>
                          <TableCell className="text-sm">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">No recent payments.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Reviews</CardTitle>
                <CardDescription>Last 10 reviewing actions</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recent?.reviews?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Decision</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Transcription</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recent.reviews.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.decision}</TableCell>
                          <TableCell className="text-sm">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{r.transcriptionId}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-muted-foreground">No recent reviews.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
