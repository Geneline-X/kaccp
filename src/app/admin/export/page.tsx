"use client"
import { useState } from 'react'
import { apiFetch } from '@/lib/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function AdminExportPage() {
  const [writeToGCS, setWriteToGCS] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runExport = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch('/api/admin/export', {
        method: 'POST',
        body: JSON.stringify({ writeToGCS })
      })
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Export</h1>

      <Card>
        <CardHeader><CardTitle>Build Master Dataset</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Write to Google Cloud Storage</Label>
              <p className="text-xs text-muted-foreground">Uploads CSV and JSON under <code>final_datasets/</code> in your bucket.</p>
            </div>
            <Switch checked={writeToGCS} onCheckedChange={setWriteToGCS} />
          </div>
          <Button onClick={runExport} disabled={loading}>{loading ? 'Exporting…' : 'Run Export'}</Button>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {result && (
            <div className="text-sm space-y-1">
              <div>Rows: <span className="font-mono">{result.count}</span></div>
              {result.csvUploaded && (
                <div>CSV: {result.csvUploaded.uploaded ? <span className="text-green-700">{result.csvUploaded.gcsPath}</span> : <span className="text-amber-700">Not uploaded</span>}</div>
              )}
              {result.jsonUploaded && (
                <div>JSON: {result.jsonUploaded.uploaded ? <span className="text-green-700">{result.jsonUploaded.gcsPath}</span> : <span className="text-amber-700">Not uploaded</span>}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
