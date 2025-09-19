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
      <h1 className="text-2xl font-semibold">Pending Reviews</h1>

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

  const submit = async () => {
    setSubmitting(true)
    try {
      await apiFetch(`/api/admin/reviews/${item.id}`, {
        method: 'POST',
        body: JSON.stringify({ decision, comments, useAiSuggestion })
      })
      setOpen(false)
      onAction()
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border rounded p-3">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">Chunk #{item.chunk?.index} · Duration {item.chunk?.durationSec}s</div>
        <div>
          <div className="text-xs font-medium mb-1">Original</div>
          <div className="text-sm whitespace-pre-wrap">{item.text}</div>
        </div>
        {item.aiSuggestedText && (
          <div>
            <div className="text-xs font-medium mb-1">AI Suggestion</div>
            <div className="text-sm whitespace-pre-wrap">{item.aiSuggestedText}</div>
          </div>
        )}
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
