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
import { useTranslations } from 'next-intl'

export default function TranscriberTaskPage() {
  const ready = useRequireTranscriberAuth()
  const t = useTranslations()
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
        toast.error(e.message || t('transcriber.failedToLoadAudio'))
      } finally {
        setLoading(false)
      }
    }
    if (ready) load()
  }, [chunkId, ready, t])

  const onImprove = async () => {
    if (!text.trim()) return toast.error(t('transcriber.enterTextFirst'))
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
      toast.error(e.message || t('transcriber.aiCorrectionFailed'))
    }
    finally {
      setImproving(false)
    }
  }

  const onSaveDraft = async () => {
    if (!assignmentId) return toast.error(t('transcriber.missingAssignmentId'))
    if (!text.trim()) return toast.error(t('transcriber.nothingToSave'))
    try {
      setSaving(true)
      await apiFetch('/api/transcriber/save-draft', { method: 'POST', body: JSON.stringify({ assignmentId, text, language: 'en' }) })
      toast.success(t('transcriber.draftSaved'))
      // Notify other tabs/pages to refresh drafts
      try { localStorage.setItem('kaccp_drafts_updated', String(Date.now())) } catch { }
    } catch (e: any) {
      toast.error(e.message || t('transcriber.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = async () => {
    if (!assignmentId) {
      return toast.error(t('transcriber.missingAssignmentIdOpen'))
    }
    if (!text.trim()) {
      return toast.error(t('transcriber.pleaseEnterTranscription'))
    }
    try {
      setSubmitting(true)
      await apiFetch('/api/transcriber/transcriptions', { method: 'POST', body: JSON.stringify({ assignmentId, text, language: 'en' }) })
      toast.success(t('transcriber.submittedForReview'))
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || t('transcriber.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const onReportBroken = async () => {
    if (!confirm(t('transcriber.reportBrokenConfirm'))) return
    try {
      setReporting(true)
      await apiFetch('/api/transcriber/chunks/report-broken', {
        method: 'POST',
        body: JSON.stringify({ chunkId }),
      })
      toast.success(t('transcriber.audioReportedBroken'))
      router.replace('/transcriber')
    } catch (e: any) {
      toast.error(e.message || t('transcriber.reportFailed'))
    } finally {
      setReporting(false)
    }
  }

  if (!ready) return null
  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('transcriber.transcriptionTask')}</h1>
        <Button variant="secondary" onClick={() => router.push('/transcriber')}>{t('transcriber.backToDashboard')}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('transcriber.audio')}</CardTitle>
          <CardDescription>{t('transcriber.chunkId')}: {chunkId}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-24"><div className="h-8 w-8 rounded-full border-b-2 border-primary animate-spin"></div></div>
          ) : audioUrl ? (
            <audio src={audioUrl} controls autoPlay className="w-full" />
          ) : (
            <div className="text-destructive">{t('transcriber.noAudioUrl')}</div>
          )}
          <div className="mt-3">
            <Button
              size="sm"
              variant="destructive"
              onClick={onReportBroken}
              disabled={reporting || loading}
            >
              {reporting ? t('transcriber.reporting') : t('transcriber.reportBrokenAudio')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('transcriber.yourTranscription')}</CardTitle>
          <CardDescription>{t('transcriber.writeEnglishTranscription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('transcriber.typeTranscriptHere')} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={onImprove} disabled={improving}>{improving ? t('transcriber.improving') : t('transcriber.improveEnglish')}</Button>
            <Button size="sm" className="whitespace-nowrap" variant="secondary" onClick={onSaveDraft} disabled={saving}>{saving ? t('common.saving') : t('transcriber.saveDraft')}</Button>
            <Button size="sm" className="whitespace-nowrap" onClick={onSubmit} disabled={submitting}>{submitting ? t('transcriber.submitting') : t('common.submit')}</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transcriber.applyAiCorrections')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{t('transcriber.previewCorrectedText')}</div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <div className="font-medium mb-1">{t('transcriber.yourText')}</div>
                <div className="p-2 rounded border bg-muted whitespace-pre-wrap max-h-40 overflow-y-auto">{text}</div>
              </div>
              <div>
                <div className="font-medium mb-1">{t('transcriber.aiSuggestion')}</div>
                <div className="p-2 rounded border bg-muted whitespace-pre-wrap max-h-40 overflow-y-auto">{aiPreview || text}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { if (aiPreview) setText(aiPreview); setConfirmOpen(false); toast.success(t('transcriber.appliedAiCorrections')) }}>{t('transcriber.apply')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
