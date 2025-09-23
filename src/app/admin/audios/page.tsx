"use client"
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Progress } from '@/components/ui/progress'
import type { AudioRow } from '@/components/admin/audios/audios-table'
import { toastError, toastSuccess } from '@/lib/toast'
import Link from 'next/link'
import { toast } from 'sonner'

export default function AdminAudiosPage() {
  const [items, setItems] = useState<AudioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  const [title, setTitle] = useState('')
  const [originalUri, setOriginalUri] = useState('')
  const [description, setDescription] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Ingest via Python worker (YouTube)
  const [ingestTitle, setIngestTitle] = useState('')
  const [ingestUrl, setIngestUrl] = useState('')
  const [ingestChunkSeconds, setIngestChunkSeconds] = useState<number | ''>('')
  const [ingesting, setIngesting] = useState(false)
  const [showIngestForm, setShowIngestForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ items: any[]; total: number; page: number; pageSize: number }>(`/api/admin/audios?page=${page}&pageSize=${pageSize}`)
      setItems(res.items as any)
      setTotal(res.total || 0)
    } catch (e: any) {
      const msg = e.message || 'Failed to load audios'
      setError(msg)
      toastError('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await apiFetch("/api/admin/audios", {
        method: 'POST',
        body: JSON.stringify({ title, originalUri, description, sourceRef })
      })
      toastSuccess('Audio source created')
      setTitle('')
      setOriginalUri('')
      setDescription('')
      setSourceRef('')
      setShowCreateForm(false)
      await load()
    } catch (e: any) {
      toastError('Failed to create audio', e.message)
    } finally {
      setCreating(false)
    }
  }

  const onIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestTitle || !ingestUrl) {
      return toastError('Validation', 'Title and YouTube URL are required')
    }
    try {
      setIngesting(true)
      const resp = await fetch('/api/ingest-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ingestTitle,
          description: '',
          url: ingestUrl,
          chunkSeconds: ingestChunkSeconds === '' ? undefined : Number(ingestChunkSeconds)
        })
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        throw new Error(j.error || `Request failed: ${resp.status}`)
      }
      const data = await resp.json()
      toastSuccess(`Ingest started (source ${data.sourceId})`)
      setIngestTitle('')
      setIngestUrl('')
      setIngestChunkSeconds('')
      setShowIngestForm(false)
      await load()
    } catch (e: any) {
      toastError('Failed to start ingest', e.message)
    } finally {
      setIngesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Audios" 
        description="Create and manage audio sources"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowIngestForm(!showIngestForm)}>{showIngestForm ? 'Cancel Ingest' : 'Ingest YouTube'}</Button>
            <Button variant="secondary" onClick={() => setShowCreateForm(!showCreateForm)}>{showCreateForm ? 'Cancel Create' : 'Add Source'}</Button>
          </div>
        }
      />

      {showIngestForm && (
        <Card>
          <CardHeader>
            <CardTitle>Ingest from YouTube</CardTitle>
            <CardDescription>Start background processing via the Python worker</CardDescription>
          </CardHeader>
          <form onSubmit={onIngest}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <Label>YouTube URL</Label>
                <Input value={ingestUrl} onChange={(e) => setIngestUrl(e.target.value)} required />
              </div>
              <div>
                <Label>Chunk Seconds (optional)</Label>
                <Input type="number" min={5} max={60} value={ingestChunkSeconds} onChange={(e) => setIngestChunkSeconds(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={ingesting}>{ingesting ? 'Starting…' : 'Start Ingest'}</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Audio Source</CardTitle>
            <CardDescription>Add a new audio source to the dataset</CardDescription>
          </CardHeader>
          <form onSubmit={onCreate}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <Label>Original URI (YouTube URL or audio link)</Label>
                <Input value={originalUri} onChange={(e) => setOriginalUri(e.target.value)} required />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Source Ref (optional)</Label>
                <Input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>
            Page {page} of {Math.max(1, Math.ceil(total / pageSize))} · {total} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-destructive p-4 rounded-md bg-destructive/10">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source ID</th>
                    <th className="px-3 py-2">Chunks</th>
                    <th className="px-3 py-2">Progress</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium line-clamp-1">{a.title}</div>
                        <div className="text-xs text-muted-foreground break-all line-clamp-1">{a.originalUri}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={a.status as any} />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <code className="text-xs truncate max-w-[200px]" title={a.id}>{a.id}</code>
                          <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(a.id); toast.success('Source ID copied'); }}>Copy</Button>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">{(a as any)._count?.chunks ?? 0}</td>
                      <td className="px-3 py-2 align-top w-[260px]">
                        {renderProgress(a as any)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/admin/audios/${a.id}/chunks`}>Manage Chunks</Link>
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            disabled={deletingId === a.id}
                            onClick={async () => {
                              if (!confirm('Delete this source and all its chunks? This can also purge storage.')) return
                              try {
                                setDeletingId(a.id)
                                await toast.promise(
                                  (async () => {
                                    const resp = await fetch(`/api/admin/audios/${a.id}?purge=1`, { method: 'DELETE' })
                                    if (!resp.ok) throw new Error((await resp.json()).error || `Failed: ${resp.status}`)
                                    await load()
                                  })(),
                                  {
                                    loading: 'Deleting source…',
                                    success: 'Audio source deleted',
                                    error: (e) => e?.message || 'Delete failed',
                                  }
                                )
                              } catch (e: any) {
                                // error handled by toast.promise
                              } finally {
                                setDeletingId(null)
                              }
                            }}
                          >
                            {deletingId === a.id ? 'Deleting…' : 'Delete Source'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center gap-2 justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <select className="border rounded px-2 py-1" value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value) || 25); setPage(1) }}>
                    {[10,25,50,100,200].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: 'UPLOADED'|'PROCESSING'|'READY'|'TRANSCRIBING'|'COMPLETED'|'FAILED'|string }) {
  let cls = 'bg-muted text-foreground'
  if (status === 'READY' || status === 'COMPLETED') cls = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
  else if (status === 'PROCESSING' || status === 'TRANSCRIBING') cls = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
  else if (status === 'FAILED') cls = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
      {status === 'PROCESSING' && (
        <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-current"></span>
      )}
    </span>
  )
}

function renderProgress(a: any) {
  const total = a?._count?.chunks ?? 0
  const progress = a?.progress || {}
  const approved = Number(progress.APPROVED || 0)
  const submitted = Number(progress.SUBMITTED || 0)
  const assigned = Number(progress.ASSIGNED || 0)
  const done = approved
  const inProgress = submitted + assigned
  const remaining = Math.max(0, total - done - inProgress)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span>Approved {done}/{total}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} />
      <div className="mt-1 text-[10px] text-muted-foreground">In progress: {inProgress} · Remaining: {remaining}</div>
    </div>
  )
}
