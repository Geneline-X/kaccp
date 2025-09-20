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
  const [submitted, setSubmitted] = useState<any[]>([])
  const [loadingSubmitted, setLoadingSubmitted] = useState(false)
  const [subFilter, setSubFilter] = useState<'PENDING'|'APPROVED'|'REJECTED'|'EDIT_REQUESTED'|'ALL'>('PENDING')
  const [subPage, setSubPage] = useState(1)
  const [subPageSize, setSubPageSize] = useState(25)
  const [subTotal, setSubTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState<number>(0)
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

  const loadSubmitted = async () => {
    try {
      setLoadingSubmitted(true)
      const q = new URLSearchParams()
      q.set('status', subFilter)
      q.set('page', String(subPage))
      q.set('pageSize', String(subPageSize))
      const data = await apiFetch<{ items: any[]; page: number; pageSize: number; total: number }>(`/api/transcriber/submissions?${q.toString()}`)
      setSubmitted(data.items || [])
      setSubPage(data.page || subPage)
      setSubPageSize(data.pageSize || subPageSize)
      setSubTotal(data.total || 0)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load submissions')
    } finally {
      setLoadingSubmitted(false)
    }
  }

  const loadPendingCount = async () => {
    try {
      const q = new URLSearchParams()
      q.set('status', 'PENDING')
      q.set('page', '1')
      q.set('pageSize', '1')
      const data = await apiFetch<{ items: any[]; page: number; pageSize: number; total: number }>(`/api/transcriber/submissions?${q.toString()}`)
      setPendingCount(data.total || 0)
    } catch {}
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

  useEffect(() => { loadMy(); loadMe(); loadStats(); loadDrafts(); loadSubmitted(); }, [])
  useEffect(() => { loadAvailable() }, [page, pageSize])
  useEffect(() => { loadSubmitted(); loadPendingCount() }, [subPage, subPageSize, subFilter])
  useEffect(() => { if (tab === 'my') { loadSubmitted(); loadPendingCount() } }, [tab])

  // Refresh drafts on cross-tab save notifications
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'kaccp_drafts_updated') {
        loadDrafts()
      }
    }
    window.addEventListener('storage', handler)
    // Close mobile menu if other panels (like notifications) request it
    const closeMenuHandler = () => setMenuOpen(false)
    window.addEventListener('kaccp_close_menu' as any, closeMenuHandler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('kaccp_close_menu' as any, closeMenuHandler as any)
    }
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
      // Friendly message if user hit active assignment limit
      let msg = e?.message || 'Claim failed'
      try {
        const parsed = JSON.parse(msg)
        const errorText = String(parsed?.error || '').toLowerCase()
        if (errorText.includes('active assignment')) {
          const first = parsed.assignments?.[0]
          const chunkNo = first?.chunk?.index != null ? `#${first.chunk.index}` : ''
          msg = `You can only work on one chunk at a time. Please finish or release your current assignment ${chunkNo} before claiming another.`
        } else if (errorText.includes('no longer available')) {
          msg = 'That chunk was just claimed by someone else. Please pick another.'
          // Refresh list so user sees up-to-date availability
          loadAvailable()
        }
      } catch {}
      toast.error(msg)
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
      let msg = e?.message || 'Claim failed'
      try {
        const parsed = JSON.parse(msg)
        const errorText = String(parsed?.error || '').toLowerCase()
        if (errorText.includes('active assignment')) {
          const first = parsed.assignments?.[0]
          const chunkNo = first?.chunk?.index != null ? `#${first.chunk.index}` : ''
          msg = `You can only work on one chunk at a time. Please finish or release your current assignment ${chunkNo} before claiming another.`
        } else if (errorText.includes('no longer available')) {
          msg = 'That chunk was just claimed by someone else. Please pick another.'
          loadAvailable()
        }
      } catch {}
      toast.error(msg)
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
        <div className="sm:hidden flex items-center gap-2">
          <NotificationsBell />
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

      {/* Bottom navbar removed per request; using header menu for navigation only */}

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

      {tab === 'my' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">My Submissions{typeof pendingCount === 'number' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800">{pendingCount} pending</span>
            )}</CardTitle>
            <CardDescription>Submissions awaiting review or decided</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-hidden">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                className="border rounded px-2 py-1 text-sm max-w-[60%] sm:max-w-none"
                value={subFilter}
                onChange={(e) => { setSubFilter(e.target.value as any); setSubPage(1) }}
              >
                <option value="PENDING">Pending</option>
                <option value="EDIT_REQUESTED">Edit Requested</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ALL">All</option>
              </select>
              <div className="w-full sm:w-auto ml-0 sm:ml-auto flex flex-wrap items-center gap-2 text-xs sm:text-sm justify-between">
                <Button variant="secondary" size="sm" onClick={loadSubmitted} disabled={loadingSubmitted}>Refresh</Button>
                <span className="min-w-0 truncate">Page {subPage} of {Math.max(1, Math.ceil(subTotal / subPageSize))}</span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={subPage <= 1 || loadingSubmitted} onClick={() => setSubPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="secondary" size="sm" disabled={subPage >= Math.ceil(subTotal / subPageSize) || loadingSubmitted} onClick={() => setSubPage(p => p + 1)}>Next</Button>
                </div>
                <select
                  className="border rounded px-2 py-1 text-sm max-w-[40%] sm:max-w-none"
                  value={subPageSize}
                  onChange={(e) => setSubPageSize(parseInt(e.target.value) || 25)}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            {loadingSubmitted ? (
              <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
            ) : submitted.length === 0 ? (
              <div className="text-sm text-muted-foreground">No submissions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submitted.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>#{s.chunk?.index}</TableCell>
                        <TableCell className="text-xs">{s.chunk?.sourceId}</TableCell>
                        <TableCell>{s.chunk?.durationSec}s</TableCell>
                        <TableCell>{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-xs">{s.status}</TableCell>
                        <TableCell className="text-right">
                          {s.status === 'EDIT_REQUESTED' ? (
                            <Button asChild size="sm"><Link href={`/transcriber/task/${s.chunkId}?a=${s.assignmentId || ''}`}>Continue</Link></Button>
                          ) : (
                            <Button asChild size="sm" variant="secondary"><Link href={`/transcriber/task/${s.chunkId}`}>View</Link></Button>
                          )}
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
