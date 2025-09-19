import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildMasterDataset, uploadToGCS } from '@/lib/export'
import { requireAdmin } from '@/lib/auth'

const ExportSchema = z.object({
  writeToGCS: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { writeToGCS } = ExportSchema.parse(body)

    const { csv, json, count } = await buildMasterDataset()

    if (writeToGCS) {
      const base = 'final_datasets/master_krio_english_corpus'
      const upCsv = await uploadToGCS(`${base}.csv`, csv, 'text/csv')
      const upJson = await uploadToGCS(`${base}.json`, json, 'application/json')
      return NextResponse.json({ count, csvUploaded: upCsv, jsonUploaded: upJson })
    }

    // If not writing to GCS, return files inline (be careful with size)
    return NextResponse.json({ count, csv, json })
  } catch (e: any) {
    console.error('admin/export error', e)
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 })
  }
}
