"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/client'
import clsx from 'clsx'

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

  const rankOf = (i: number) => (page-1)*pageSize + i + 1
  const top3 = !loading ? items.slice(0, 3) : []
  const rest = !loading ? items.slice(3) : []

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto space-y-6">
      <Card className="bg-gradient-to-r from-sky-50 to-amber-50">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🏆 Leaderboard</span>
              </CardTitle>
              <CardDescription>Top transcribers by approved minutes • Rate {rate.toFixed(2)} SLE/min</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary"><Link href="/transcriber">My Dashboard</Link></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-5">
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
            <div className="space-y-6">
              {/* Podium */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((it, i) => (
                  <div key={it.userId} className={clsx(
                    "rounded-lg p-4 border shadow-sm bg-white/80 hover:shadow-md transition",
                    i===0 && "ring-2 ring-yellow-400",
                    i===1 && "ring-2 ring-gray-300",
                    i===2 && "ring-2 ring-amber-700/40",
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                          {it.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">NA</div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{it.country || '—'}</div>
                        </div>
                      </div>
                      <div className="text-2xl">
                        {i===0 ? '🥇' : i===1 ? '🥈' : '🥉'}
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Approved minutes</div>
                        <div className="text-xl font-bold">{it.approvedMinutes.toFixed(1)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Est. SLE</div>
                        <div className="text-xl font-bold">{it.estimatedSLE.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rest table with progress */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead className="text-right">Approved min</TableHead>
                      <TableHead className="text-right">Est. SLE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rest.map((it, i) => (
                      <TableRow key={it.userId} className="hover:bg-sky-50/40">
                        <TableCell className="font-medium">{rankOf(i+3)}</TableCell>
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
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div>{it.approvedMinutes.toFixed(1)}</div>
                            <div className="w-40 h-1.5 bg-slate-200 rounded overflow-hidden">
                              <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (it.approvedMinutes/(top3[0]?.approvedMinutes||1))*100)}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{it.estimatedSLE.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
