"use client"

import { useEffect, useState } from 'react'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiFetch } from '@/lib/client'

export default function AdminApprovedPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [revertingId, setRevertingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const q = new URLSearchParams()
      q.set('page', String(page))
      q.set('pageSize', String(pageSize))
      const res = await apiFetch<{ items: any[]; page: number; pageSize: number; total: number }>(`/api/admin/approved?${q.toString()}`)
      setItems(res.items || [])
      setPage(res.page || page)
      setPageSize(res.pageSize || pageSize)
      setTotal(res.total || 0)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize])

  const onRevert = async (chunkId: string) => {
    setTargetId(chunkId)
    setConfirmOpen(true)
  }

  const confirmRevert = async () => {
    if (!targetId) return
    try {
      setRevertingId(targetId)
      await apiFetch(`/api/admin/approved/${targetId}/revert`, { method: 'POST' })
      await load()
      setConfirmOpen(false)
      setTargetId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setRevertingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <AdminHeader title="Approved Data" description="All approved chunks with their final transcription" />

      <Card>
        <CardHeader>
          <CardTitle>Approved Items</CardTitle>
          <CardDescription>Audio with final text (AI suggestion if selected in review)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={page >= Math.ceil(total / pageSize) || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
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
          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No approved items yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Audio</TableHead>
                    <TableHead>Final Text</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r: any) => (
                    <TableRow key={r.chunk.id}>
                      <TableCell>#{r.chunk.index}</TableCell>
                      <TableCell className="text-xs">{r.chunk.sourceId}</TableCell>
                      <TableCell>{r.chunk.durationSec}s</TableCell>
                      <TableCell>{r.chunk.url ? <audio src={r.chunk.url} controls preload="none" /> : '-'}</TableCell>
                      <TableCell className="max-w-[480px] text-xs whitespace-pre-wrap">{r.transcription.text}</TableCell>
                      <TableCell className="text-xs">{r.transcription.user?.displayName || r.transcription.user?.email || '—'}</TableCell>
                      <TableCell className="text-xs">{r.transcription.submittedAt ? new Date(r.transcription.submittedAt).toLocaleString() : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="secondary" disabled={revertingId === r.chunk.id} onClick={() => onRevert(r.chunk.id)}>
                          {revertingId === r.chunk.id ? 'Reverting…' : 'Revert'}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert Approved Item</DialogTitle>
            <DialogDescription>
              This will move the item back to Submitted for re-review and remove the approval record. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRevert} disabled={!!revertingId}>
              {revertingId ? 'Reverting…' : 'Revert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
