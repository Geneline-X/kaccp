"use client"
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRequireTranscriberAuth } from '@/lib/useTranscriberAuth'
import { apiFetch } from '@/lib/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function TranscriberTaskPage() {
  const ready = useRequireTranscriberAuth()
  const { chunkId } = useParams<{ chunkId: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const assignmentId = search?.get('a') || ''

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [improving, setImproving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [aiPreview, setAiPreview] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!chunkId) return
      setLoading(true)
      try {
        const data = await apiFetch<{ url: string }>(`/api/chunk-url?id=${chunkId}`)
        setAudioUrl(data.url)
        // Load latest draft and prefill text
        const q = new URLSearchParams()
        if (assignmentId) q.set('assignmentId', assignmentId)
        else q.set('chunkId', String(chunkId))
        const draftRes = await apiFetch<{ draft?: { text?: string | null } }>(`/api/transcriber/draft?${q.toString()}`)
        if (draftRes?.draft?.text) setText(draftRes.draft.text)
      } catch (e: any) {
        toast.error(e.message || 'Failed to load audio')
      } finally {
        setLoading(false)
      }
    }
    if (ready) load()
  }, [chunkId, ready])

  const onImprove = async () => {
    if (!text.trim()) return toast.error('Enter some text first')
    try {
      setImproving(true)
      const res = await apiFetch<{ corrected: string; model?: string; score?: number }>(`/api/transcriber/improve`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      const next = res.corrected || text
      setAiPreview(next)
      setConfirmOpen(true)
    } catch (e: any) {
      toast.error(e.message || 'AI correction failed')
    }
    finally {
      setImproving(false)
    }
  }

  const onSaveDraft = async () => {
    if (!assignmentId) return toast.error('Missing assignment id')
    if (!text.trim()) return toast.error('Nothing to save')
    try {
      setSaving(true)
      await apiFetch('/api/transcriber/save-draft', { method: 'POST', body: JSON.stringify({ assignmentId, text, language: 'en' }) })
      toast.success('Draft saved')
      // Notify other tabs/pages to refresh drafts
      try { localStorage.setItem('kaccp_drafts_updated', String(Date.now())) } catch {}
    } catch (e: any) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async () => {
    if (!assignmentId) {
      return toast.error('Missing assignment id. Open this task from your dashboard again.')
    }
    if (!text.trim()) {
      return toast.error('Please enter a transcription before submitting')
    }
    try {
      setSubmitting(true)
      await apiFetch('/api/transcriber/transcriptions', { method: 'POST', body: JSON.stringify({ assignmentId, text, language: 'en' }) })
      toast.success('Submitted for review')
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onReportBroken = async () => {
    if (!confirm('Report this audio as broken? It will be removed from available chunks.')) return
    try {
      setReporting(true)
      await apiFetch('/api/transcriber/chunks/report-broken', {
        method: 'POST',
        body: JSON.stringify({ chunkId }),
      })
      toast.success('Audio reported as broken')
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || 'Report failed')
    } finally {
      setReporting(false)
    }
  }

  if (!ready) return null
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transcription Task</h1>
        <Button variant="secondary" onClick={() => router.push('/transcriber')}>Back to Dashboard</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audio</CardTitle>
          <CardDescription>Chunk ID: {chunkId}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : audioUrl ? (
            <audio src={audioUrl} controls autoPlay className="w-full" />
          ) : (
            <div className="text-destructive">No audio URL available</div>
          )}
          <div className="mt-3">
            <Button
              size="sm"
              variant="destructive"
              onClick={onReportBroken}
              disabled={reporting || loading}
            >
              {reporting ? 'Reporting...' : 'Report Broken Audio'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Transcription</CardTitle>
          <CardDescription>Write the English transcription for this audio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type the transcript here..." />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={onImprove} disabled={improving}>{improving ? 'Improving…' : 'Improve English'}</Button>
            <Button size="sm" className="whitespace-nowrap" variant="secondary" onClick={onSaveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save Draft'}</Button>
            <Button size="sm" className="whitespace-nowrap" onClick={onSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply AI Corrections?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Preview the corrected text. You can still edit after applying.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="font-medium mb-1">Your text</div>
                <div className="p-2 rounded border bg-muted whitespace-pre-wrap">{text}</div>
              </div>
              <div>
                <div className="font-medium mb-1">AI suggestion</div>
                <div className="p-2 rounded border bg-muted whitespace-pre-wrap">{aiPreview || text}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (aiPreview) setText(aiPreview); setConfirmOpen(false); toast.success('Applied AI corrections') }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
