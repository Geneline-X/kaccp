"use client"
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/client'

export default function LeaderboardPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'all' | '7d' | '30d'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [rate, setRate] = useState(1.2)

  const load = async () => {
    try {
      setLoading(true)
      const q = new URLSearchParams({ range, page: String(page), pageSize: String(pageSize) })
      const data = await apiFetch<{ items: any[]; total: number; page: number; pageSize: number; ratePerMinuteSLE: number }>(`/api/leaderboard?${q.toString()}`)
      setItems(data.items || [])
      setTotal(data.total || 0)
      setPage(data.page || page)
      setPageSize(data.pageSize || pageSize)
      setRate(data.ratePerMinuteSLE || 1.2)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [range, page, pageSize])

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Top transcribers by approved minutes • Rate {rate.toFixed(2)} SLE/min</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <select className="border rounded px-2 py-1" value={range} onChange={(e) => setRange(e.target.value as any)}>
              <option value="all">All-time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span>Page {page} of {pages}</span>
              <Button variant="secondary" size="sm" disabled={page<=1||loading} onClick={() => setPage(p=>Math.max(1,p-1))}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={page>=pages||loading} onClick={() => setPage(p=>p+1)}>Next</Button>
              <select className="border rounded px-2 py-1" value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value)||25)}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground">No data.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Approved minutes</TableHead>
                    <TableHead className="text-right">Estimated SLE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={it.userId}>
                      <TableCell>{(page-1)*pageSize + i + 1}</TableCell>
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
                          <div className="text-sm">{it.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{it.country || '-'}</TableCell>
                      <TableCell className="text-right">{it.approvedMinutes.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{it.estimatedSLE.toFixed(2)}</TableCell>
                    </TableRow>
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
