"use client"
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { AdminHeader } from '@/components/admin/AdminHeader'

export default function AdminReviewsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ items: any[] }>("/api/admin/reviews")
      setItems(res.items)
    } catch (e: any) {
      setError(e.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <AdminHeader title="Pending Reviews" description="Review, edit, and approve submissions" />

      <Card>
        <CardHeader><CardTitle>Queue</CardTitle></CardHeader>
        <CardContent>
          {loading ? 'Loading...' : error ? <div className="text-red-600">{error}</div> : (
            <div className="space-y-3">
              {items.map((t) => (
                <ReviewRow key={t.id} item={t} onAction={load} />
              ))}
              {items.length === 0 && <div>No pending submissions.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReviewRow({ item, onAction }: { item: any; onAction: () => void }) {
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState<'APPROVED'|'REJECTED'|'EDIT_REQUESTED'>('APPROVED')
  const [useAiSuggestion, setUseAiSuggestion] = useState<boolean>(true)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editedText, setEditedText] = useState<string>(item.text || '')
  const [improving, setImproving] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload: any = { decision, comments, useAiSuggestion }
      if (decision === 'APPROVED') {
        payload.editedText = editedText
      }
      await apiFetch(`/api/admin/reviews/${item.id}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setOpen(false)
      onAction()
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const improve = async () => {
    setImproving(true)
    try {
      const res = await apiFetch<{ corrected: string; score: number }>(`/api/admin/reviews/${item.id}/improve`, {
        method: 'POST',
        body: JSON.stringify({ text: editedText })
      })
      setEditedText(res.corrected)
      toast.success(`Improved (confidence ${(res.score * 100).toFixed(0)}%)`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to improve text')
    } finally {
      setImproving(false)
    }
  }

  return (
    <div className="border rounded p-3">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
          <span>Chunk #{item.chunk?.index} · Duration {item.chunk?.durationSec}s</span>
          {item.chunk?.url ? (
            <audio src={item.chunk.url} controls preload="none" className="mt-1" />
          ) : null}
        </div>
        {/* Submitter info */}
        <div className="rounded-md border bg-card/50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-medium">{item.user?.displayName || item.user?.email}</div>
              <div className="text-xs text-muted-foreground">
                {item.user?.email}
                {item.user?.country ? ` • ${item.user.country}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="text-muted-foreground">Role: <span className="text-foreground">{item.user?.role}</span></div>
              <div className="text-muted-foreground">Quality: <span className="text-foreground">{typeof item.user?.qualityScore === 'number' ? item.user.qualityScore.toFixed(2) : '—'}</span></div>
              <div className="text-muted-foreground">Earnings: <span className="text-foreground">{typeof item.user?.totalEarningsCents === 'number' ? (item.user.totalEarningsCents/100).toFixed(2) : '0.00'} SLE</span></div>
              <div className="text-muted-foreground">Last login: <span className="text-foreground">{item.user?.lastLoginAt ? new Date(item.user.lastLoginAt).toLocaleDateString() : '—'}</span></div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium">Edit Text</div>
          <Textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={5} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={improve} disabled={improving}>
              {improving ? 'Improving…' : 'Improve Text'}
            </Button>
            {item.aiSuggestedText && (
              <Button size="sm" variant="ghost" onClick={() => setEditedText(item.aiSuggestedText)}>
                Use AI Suggestion
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditedText(item.text)}>
              Reset to Original
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Review</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Review</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <RadioGroup value={decision} onValueChange={(v) => setDecision(v as any)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="APPROVED" id={`approved-${item.id}`} />
                      <Label htmlFor={`approved-${item.id}`}>Approve</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="REJECTED" id={`rejected-${item.id}`} />
                      <Label htmlFor={`rejected-${item.id}`}>Reject</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EDIT_REQUESTED" id={`edit-${item.id}`} />
                      <Label htmlFor={`edit-${item.id}`}>Request Edit</Label>
                    </div>
                  </RadioGroup>
                </div>
                {decision === 'APPROVED' && (
                  <div className="space-y-2">
                    <Label>Use AI Suggestion (if available)</Label>
                    <RadioGroup value={useAiSuggestion ? 'yes' : 'no'} onValueChange={(v) => setUseAiSuggestion(v === 'yes')} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`ai-yes-${item.id}`} />
                        <Label htmlFor={`ai-yes-${item.id}`}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`ai-no-${item.id}`} />
                        <Label htmlFor={`ai-no-${item.id}`}>No</Label>
                      </div>
                    </RadioGroup>
                    <div className="space-y-2">
                      <Label>Final Approved Text</Label>
                      <Textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} rows={5} />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Comments (optional)</Label>
                  <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
