"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useRequireTranscriberAuth } from '@/lib/useTranscriberAuth'
import NotificationsBell from '@/components/transcriber/NotificationsBell'
import { apiFetch } from '@/lib/client'
import { clearToken } from '@/lib/client'
import { useRouter, usePathname } from 'next/navigation'

export default function TranscriberDashboardPage() {
  const ready = useRequireTranscriberAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'available'|'my'|'drafts'>('my')
  const [loading, setLoading] = useState(false)
  const [assignments, setAssignments] = useState<any[]>([])
  const [claimingNext, setClaimingNext] = useState(false)
  const [claimingChunkId, setClaimingChunkId] = useState<string | null>(null)
  const [releasingId, setReleasingId] = useState<string | null>(null)
  // Hooks that must run unconditionally (before any early return)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => { setMenuOpen(false) }, [pathname])
  const [available, setAvailable] = useState<any[]>([])
  const [loadingAvail, setLoadingAvail] = useState(false)
  const [me, setMe] = useState<any | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<any | null>(null)
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  const loadMy = async () => {
    try {
      setLoading(true)
      const data = await apiFetch<{ items: any[] }>(`/api/transcriber/me/assignments`)
      setAssignments(data.items || [])
    } catch (e: any) {
      toast.error(e.message || 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  const loadMe = async () => {
    try {
      const data = await apiFetch<{ user: any }>(`/api/auth/me`)
      setMe(data.user || null)
    } catch {}
  }

  const loadStats = async () => {
    try {
      const data = await apiFetch(`/api/transcriber/stats`)
      setStats(data)
    } catch {}
  }

  const loadAvailable = async () => {
    try {
      setLoadingAvail(true)
      const q = new URLSearchParams()
      q.set('page', String(page))
      q.set('pageSize', String(pageSize))
      const data = await apiFetch<{ items: any[]; page: number; pageSize: number; total: number }>(`/api/transcriber/available?${q.toString()}`)
      setAvailable(data.items || [])
      setPage(data.page || page)
      setPageSize(data.pageSize || pageSize)
      setTotal(data.total || 0)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load available chunks')
    } finally {
      setLoadingAvail(false)
    }
  }

  useEffect(() => { loadMy(); loadMe(); loadStats(); loadDrafts(); }, [])
  useEffect(() => { loadAvailable() }, [page, pageSize])

  // Refresh drafts on cross-tab save notifications
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'kaccp_drafts_updated') {
        loadDrafts()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // When switching to drafts tab, refresh list
  useEffect(() => {
    if (tab === 'drafts') loadDrafts()
  }, [tab])

  const loadDrafts = async () => {
    try {
      setLoadingDrafts(true)
      const data = await apiFetch<{ items: any[] }>(`/api/transcriber/my-drafts`)
      setDrafts(data.items || [])
    } catch (e: any) {
      toast.error(e.message || 'Failed to load drafts')
    } finally {
      setLoadingDrafts(false)
    }
  }

  const onClaim = async () => {
    try {
      setClaimingNext(true)
      const data = await apiFetch(`/api/transcriber/chunks/claim`, { method: 'POST', body: JSON.stringify({}) })
      toast.success('Chunk claimed')
      await loadMy()
      setTab('my')
    } catch (e: any) {
      toast.error(e.message || 'Claim failed')
    } finally {
      setClaimingNext(false)
    }
  }

  const onRelease = async (assignmentId: string) => {
    try {
      setReleasingId(assignmentId)
      await apiFetch('/api/transcriber/chunks/release', { method: 'POST', body: JSON.stringify({ assignmentId }) })
      toast.success('Released')
      await loadMy()
    } catch (e: any) {
      toast.error(e.message || 'Release failed')
    } finally {
      setReleasingId(null)
    }
  }

  const claimSpecific = async (chunkId: string) => {
    try {
      setClaimingChunkId(chunkId)
      await apiFetch('/api/transcriber/chunks/claim', { method: 'POST', body: JSON.stringify({ chunkId }) })
      toast.success('Chunk claimed')
      await Promise.all([loadMy(), loadAvailable()])
      setTab('my')
    } catch (e: any) {
      toast.error(e.message || 'Claim failed')
    } finally {
      setClaimingChunkId(null)
    }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen p-4 pb-20 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transcriber Dashboard</h1>
        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-3">
          <NotificationsBell />
          {me && (
            <Link href="/transcriber/profile" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full overflow-hidden bg-muted inline-flex items-center justify-center">
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">{(me.displayName||me.email||'U').slice(0,2).toUpperCase()}</span>
                )}
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground group-hover:underline">{me.displayName || me.email}</span>
            </Link>
          )}
          <Button asChild variant="secondary"><Link href="/transcriber/profile">Profile</Link></Button>
          <Button asChild variant="secondary"><Link href="/leaderboard">Leaderboard</Link></Button>
          <Button variant={tab === 'available' ? 'default' : 'secondary'} onClick={() => setTab('available')}>Available</Button>
          <Button variant={tab === 'my' ? 'default' : 'secondary'} onClick={() => setTab('my')}>My Work</Button>
          <Button variant={tab === 'drafts' ? 'default' : 'secondary'} onClick={() => setTab('drafts')}>My Drafts</Button>
          <Button
            variant="secondary"
            onClick={() => { clearToken(); router.replace('/transcriber/login') }}
            title="Logout"
          >Logout</Button>
        </div>
        {/* Mobile actions */}
        <div className="sm:hidden">
          <Button variant="secondary" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">{menuOpen ? 'Close' : 'Menu'}</Button>
        </div>
      </div>
      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="sm:hidden grid grid-cols-2 gap-2">
          <Button asChild variant="secondary"><Link href="/transcriber/profile">Profile</Link></Button>
          <Button asChild variant="secondary"><Link href="/leaderboard">Leaderboard</Link></Button>
          <Button variant={tab === 'available' ? 'default' : 'secondary'} onClick={() => { setTab('available'); setMenuOpen(false) }}>Available</Button>
          <Button variant={tab === 'my' ? 'default' : 'secondary'} onClick={() => { setTab('my'); setMenuOpen(false) }}>My Work</Button>
          <Button variant={tab === 'drafts' ? 'default' : 'secondary'} onClick={() => { setTab('drafts'); setMenuOpen(false) }}>My Drafts</Button>
          <Button
            variant="secondary"
            onClick={() => { clearToken(); router.replace('/transcriber/login') }}
            title="Logout"
          >Logout</Button>
        </div>
      )}

      {/* Sticky bottom navbar for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 sm:hidden bg-white border-t shadow-inner">
        <div className="max-w-5xl mx-auto grid grid-cols-5 text-xs">
          <Button variant="ghost" className="rounded-none" onClick={() => { setTab('available'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Available</Button>
          <Button variant="ghost" className="rounded-none" onClick={() => { setTab('my'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>My Work</Button>
          <Button variant="ghost" className="rounded-none" onClick={() => { setTab('drafts'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Drafts</Button>
          <Button variant="ghost" className="rounded-none" asChild><Link href="/leaderboard">Leaders</Link></Button>
          <Button variant="ghost" className="rounded-none" asChild><Link href="/transcriber/profile">Profile</Link></Button>
        </div>
      </nav>

      {me && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Logged in as {me.displayName || me.email}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Email</div>
              <div>{me.email}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Quality score</div>
              <div>{(me.qualityScore ?? 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Earnings</div>
              <div>{((me.totalEarningsCents ?? 0)/100).toFixed(2)} SLE</div>
            </div>
            <div>
              <div className="text-muted-foreground">Minutes (approved/submitted)</div>
              <div>{stats ? `${(stats.approved.minutes).toFixed(1)} / ${(stats.submitted.minutes).toFixed(1)}` : '…'} min</div>
              <div className="text-xs text-muted-foreground">Rate {stats ? stats.rate.perMinuteSLE.toFixed(2) : '1.2'} SLE/min • Est. {(stats ? stats.earnings.estimatedSLE : 0).toFixed(2)} SLE</div>
            </div>
            {stats?.week && (
              <div className="md:col-span-4">
                {stats.week.eligible ? (
                  <div className="p-3 rounded border bg-green-50 text-green-900 text-sm flex items-center justify-between">
                    <div>
                      Eligible for payout this week: {(stats.week.estimatedSLE).toFixed(2)} SLE (threshold {stats.week.thresholdSLE} SLE)
                    </div>
                    <Button asChild size="sm" variant="secondary"><Link href="/transcriber/profile">Update phone</Link></Button>
                  </div>
                ) : (
                  <div className="p-3 rounded border bg-amber-50 text-amber-900 text-sm flex items-center justify-between">
                    <div>
                      Weekly progress: {(stats.week.estimatedSLE).toFixed(2)} SLE / {stats.week.thresholdSLE} SLE needed for payout eligibility.
                    </div>
                    <Button asChild size="sm" variant="secondary"><Link href="/leaderboard">See top transcribers</Link></Button>
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-4">
              <Button asChild size="sm" variant="secondary"><Link href="/transcriber/profile">My Profile</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'drafts' && (
        <Card>
          <CardHeader>
            <CardTitle>My Drafts</CardTitle>
            <CardDescription>Unsubmitted drafts you can resume</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDrafts ? (
              <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
            ) : drafts.length === 0 ? (
              <div className="text-muted-foreground">No drafts yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Snippet</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>#{d.chunk?.index}</TableCell>
                        <TableCell className="text-xs">{d.chunk?.sourceId}</TableCell>
                        <TableCell>{d.chunk?.durationSec}s</TableCell>
                        <TableCell className="max-w-[320px] text-xs truncate" title={d.text || ''}>{d.text || ''}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm"><Link href={`/transcriber/task/${d.chunkId}?a=${d.assignmentId || ''}`}>Open</Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'available' && (
        <Card>
          <CardHeader>
            <CardTitle>Available Work</CardTitle>
            <CardDescription>Click claim to get the next available chunk.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Button onClick={onClaim} disabled={claimingNext}>{claimingNext ? 'Claiming…' : 'Claim next available'}</Button>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
                <Button variant="secondary" size="sm" disabled={page <= 1 || loadingAvail} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / pageSize) || loadingAvail} onClick={() => setPage(p => p + 1)}>Next</Button>
                <select
                  className="border rounded px-2 py-1"
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value) || 25)}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            {loadingAvail ? (
              <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
            ) : available.length === 0 ? (
              <div className="text-sm text-muted-foreground">No available chunks found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {available.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>#{c.index}</TableCell>
                        <TableCell className="text-xs">{c.sourceId}</TableCell>
                        <TableCell>{c.durationSec}s</TableCell>
                        <TableCell>{c.url ? <audio src={c.url} controls preload="none" /> : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => claimSpecific(c.id)} disabled={claimingChunkId === c.id}>
                            {claimingChunkId === c.id ? 'Claiming…' : 'Claim'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'my' && (
        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>Your active assignments (auto-expire if not submitted)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
            ) : assignments.length === 0 ? (
              <div className="text-muted-foreground">No active assignments. Try claiming from the Available tab.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chunk</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>#{a.chunk?.index}</TableCell>
                        <TableCell>{a.chunk?.durationSec}s</TableCell>
                        <TableCell>{a.expiresAt ? new Date(a.expiresAt).toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button asChild size="sm"><Link href={`/transcriber/task/${a.chunkId}?a=${a.id}`}>Open</Link></Button>
                          <Button size="sm" variant="secondary" onClick={loadMy}>Refresh</Button>
                          <Button size="sm" variant="destructive" disabled={releasingId === a.id} onClick={() => onRelease(a.id)}>{releasingId === a.id ? 'Releasing…' : 'Release'}</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
