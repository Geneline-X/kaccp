"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toastError, toastSuccess } from '@/lib/toast'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'

type AudioSourceDto = {
  id: string
  title: string
  description?: string | null
  originalUri: string
  status: 'UPLOADED'|'PROCESSING'|'READY'|'TRANSCRIBING'|'COMPLETED'|'FAILED'
  totalDurationSeconds: number
  statusMessage?: string | null
  _count?: { chunks?: number }
}

type ChunkDto = {
  id: string
  index: number
  startSec: number
  endSec: number
  durationSec: number
  storageUri: string
  status: string
  url?: string
}

export default function ManageChunksPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const sourceId = params?.id
  const [source, setSource] = useState<AudioSourceDto | null>(null)
  const [chunks, setChunks] = useState<ChunkDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [scanning, setScanning] = useState(false)
  const [bucketItems, setBucketItems] = useState<Array<{ uri: string; index?: number | null; url?: string | null }>>([])
  const [deletingGsUri, setDeletingGsUri] = useState<string | null>(null)

  const isProcessing = source?.status === 'PROCESSING'

  const load = async () => {
    if (!sourceId) return
    setLoading(true)
    setError(null)
    try {
      const [srcRes, chRes] = await Promise.all([
        fetch(`/api/admin/audios/${sourceId}`),
        fetch(`/api/admin/audios/${sourceId}/chunks?signed=1`),
      ])
      if (!srcRes.ok) throw new Error((await srcRes.json()).error || 'Failed to fetch source')
      if (!chRes.ok) throw new Error((await chRes.json()).error || 'Failed to fetch chunks')
      const srcJson = await srcRes.json() as { item: AudioSourceDto }
      const chJson = await chRes.json() as { items: ChunkDto[] }
      setSource(srcJson.item)
      setChunks(chJson.items)
    } catch (e: any) {
      const msg = e.message || 'Failed to load data'
      setError(msg)
      toastError('Error', msg)
    } finally {
      setLoading(false)
    }
  }
  const onManualImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceId) return
    let payload: any
    try {
      payload = JSON.parse(importJson)
    } catch (err: any) {
      return toast.error('Invalid JSON payload')
    }
    if (!payload || payload.sourceId !== sourceId) {
      return toast.error('Payload sourceId must match current source')
    }
    await toast.promise(
      (async () => {
        const resp = await fetch('/api/manual-import-chunks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!resp.ok) throw new Error((await resp.json()).error || `Failed: ${resp.status}`)
        setImportOpen(false)
        setImportJson('')
        await refresh()
      })(),
      {
        loading: 'Importing chunks…',
        success: 'Import complete',
        error: (e) => e?.message || 'Import failed',
      }
    )
  }

  const onScanBucket = async () => {
    if (!sourceId) return
    try {
      setScanning(true)
      setBucketItems([])
      const resp = await fetch(`/api/admin/audios/${sourceId}/bucket-chunks`)
      if (!resp.ok) throw new Error((await resp.json()).error || `Failed: ${resp.status}`)
      const data = await resp.json() as { items: Array<{ uri: string; index?: number; url?: string | null }> }
      setBucketItems(data.items || [])
    } catch (e: any) {
      const msg = (e?.message || '').toString().toLowerCase()
      if (msg.includes('invalid_grant') || msg.includes('invalid grant')) {
        toast.error('Google credentials error: invalid_grant. Check GOOGLE_APPLICATION_CREDENTIALS/service account key and system clock.')
      } else {
        toastError('Scan failed', e.message)
      }
    } finally {
      setScanning(false)
    }
  }

  const onDeleteStorage = async (uri: string) => {
    await toast.promise(
      (async () => {
        setDeletingGsUri(uri)
        const resp = await fetch('/api/admin/storage/object', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gsUri: uri }),
        })
        if (!resp.ok) throw new Error((await resp.json()).error || `Failed: ${resp.status}`)
        await onScanBucket()
      })(),
      {
        loading: 'Deleting from storage…',
        success: 'Storage object deleted',
        error: (e) => e?.message || 'Delete failed',
      }
    )
    setDeletingGsUri(null)
  }

  const refresh = async () => {
    try {
      setRefreshing(true)
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [sourceId])

  // Auto-poll while processing
  useEffect(() => {
    if (!isProcessing) return
    const t = setInterval(() => { load() }, 5000)
    return () => clearInterval(t)
  }, [isProcessing])

  const onDelete = async (chunkId: string) => {
    if (!confirm('Delete this chunk? This will also remove the object from storage.')) return
    await toast.promise(
      (async () => {
        const resp = await fetch(`/api/admin/chunks/${chunkId}?purge=1`, { method: 'DELETE' })
        if (!resp.ok) throw new Error((await resp.json()).error || `Failed: ${resp.status}`)
        await refresh()
      })(),
      {
        loading: 'Deleting chunk…',
        success: 'Chunk deleted',
        error: (e) => e?.message || 'Delete failed',
      }
    )
  }

  const totalDuration = useMemo(() => {
    if (!source?.totalDurationSeconds) return '0:00:00'
    const sec = source.totalDurationSeconds
    const h = Math.floor(sec / 3600).toString().padStart(2, '0')
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
    const s = Math.floor(sec % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }, [source])

  return (
    <div className="space-y-6">
      <AdminHeader 
        title="Manage Chunks"
        description="View and moderate audio chunks"
        actions={<Button asChild variant="secondary"><Link href="/admin/audios">Back to Audios</Link></Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="font-semibold">{source?.title || 'Audio'}</span>
            {loading || isProcessing ? (
              <span className="inline-flex items-center text-sm text-muted-foreground">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></span>
                {loading ? 'Loading…' : 'Processing…'}
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            <div className="text-sm text-muted-foreground break-all">
              <div className="flex items-center gap-2">
                <span>Source ID: {sourceId}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!sourceId) return
                    await navigator.clipboard.writeText(String(sourceId))
                    toast.success('Source ID copied')
                  }}
                >
                  Copy
                </Button>
              </div>
              <div>Status: {source?.status}{source?.statusMessage ? ` — ${source.statusMessage}` : ''}</div>
              <div>Total Duration: {totalDuration}</div>
              <div>Original URI: {source?.originalUri}</div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Manual Import */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Manual Import</div>
                <div className="text-xs text-muted-foreground">Paste the JSON payload produced by your local processing script.</div>
              </div>
              <Button size="sm" variant={importOpen ? 'secondary' : 'default'} onClick={() => setImportOpen(!importOpen)}>
                {importOpen ? 'Close' : 'Open'}
              </Button>
            </div>
            {importOpen && (
              <form onSubmit={onManualImport} className="space-y-3">
                <Textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder='{"sourceId":"...","totalDurationSeconds":...,"chunksMeta":[...]}' rows={8} />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm">Import</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={onScanBucket} disabled={scanning}>{scanning ? 'Scanning…' : 'Scan Bucket'}</Button>
                </div>
                {bucketItems.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Found {bucketItems.length} objects under storage prefix. Note: durations are not inferred; use the JSON import above for authoritative metadata.
                  </div>
                )}
              </form>
            )}
          </div>

          {bucketItems.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-sm font-medium">Bucket Objects</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="px-3 py-2">Inferred #</th>
                      <th className="px-3 py-2">URI</th>
                      <th className="px-3 py-2">Preview</th>
                      <th className="px-3 py-2 text-right">Storage Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucketItems.map((b) => (
                      <tr key={b.uri} className="border-b last:border-0">
                        <td className="px-3 py-2 align-top">{typeof b.index === 'number' ? b.index : '-'}</td>
                        <td className="px-3 py-2 align-top truncate max-w-[420px]" title={b.uri}>{b.uri}</td>
                        <td className="px-3 py-2 align-top">
                          {b.url ? <audio src={b.url} controls preload="none" /> : <span className="text-xs text-muted-foreground">no url</span>}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <Button size="sm" variant="destructive" disabled={deletingGsUri === b.uri} onClick={() => onDeleteStorage(b.uri)}>
                            {deletingGsUri === b.uri ? 'Deleting…' : 'Delete from GCS'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="text-destructive p-3 rounded-md bg-destructive/10 mb-4">{error}</div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">{chunks.length} chunk{chunks.length !== 1 ? 's' : ''}</div>
            <Button size="sm" onClick={refresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : chunks.length === 0 ? (
            <div className="text-muted-foreground">No chunks yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chunks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.index}</TableCell>
                    <TableCell>{c.durationSec}s</TableCell>
                    <TableCell className="truncate max-w-[360px]" title={c.storageUri}>{c.storageUri}</TableCell>
                    <TableCell>
                      {c.url ? (
                        <audio src={c.url} controls preload="none" />
                      ) : (
                        <span className="text-xs text-muted-foreground">no url</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => onDelete(c.id)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
