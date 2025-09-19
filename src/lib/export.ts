import prisma from '@/lib/prisma'

export type ExportRow = {
  audio_filepath: string
  english_transcript: string
}

export async function buildMasterDataset() {
  // Fetch approved chunks with their approved transcription text
  const rows = await prisma.audioChunk.findMany({
    where: { approvedTranscriptionId: { not: null } },
    select: {
      id: true,
      storageUri: true,
      approvedTranscription: { select: { text: true, aiSuggestedText: true, review: { select: { useAiSuggestion: true } } } },
    },
    orderBy: { id: 'asc' },
  })

  const data: ExportRow[] = rows.map((r) => {
    const useAi = r.approvedTranscription?.review?.useAiSuggestion
    const text = useAi
      ? (r.approvedTranscription?.aiSuggestedText || r.approvedTranscription?.text || '')
      : (r.approvedTranscription?.text || '')
    return {
      audio_filepath: r.storageUri,
      english_transcript: text,
    }
  })

  const csv = toCSV(data)
  const json = JSON.stringify(data, null, 2)
  return { csv, json, count: data.length }
}

export function toCSV(rows: ExportRow[]) {
  const hdr = 'audio_filepath,english_transcript\n'
  const esc = (s: string) => {
    const needsQuotes = /[",\n]/.test(s)
    const inner = s.replace(/"/g, '""')
    return needsQuotes ? `"${inner}"` : inner
  }
  const body = rows.map((r) => `${esc(r.audio_filepath)},${esc(r.english_transcript)}`).join('\n')
  return hdr + body + '\n'
}

export async function uploadToGCS(filename: string, contents: string, contentType: string) {
  const bucketName = process.env.GCS_BUCKET
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_JSON
  if (!bucketName || !keyJson) return { uploaded: false, reason: 'Missing GCS config' }

  // Lazy import to avoid bundling unless configured
  const { Storage } = await import('@google-cloud/storage')
  const storage = new Storage({ credentials: JSON.parse(keyJson) as any })
  const bucket = storage.bucket(bucketName)
  const file = bucket.file(filename)
  await file.save(contents, { contentType, resumable: false, public: false })
  return { uploaded: true, gcsPath: `gs://${bucketName}/${filename}` }
}
