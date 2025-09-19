import { NextResponse } from 'next/server';
import { listObjects, getSignedUrl, parseGsUri } from '@/lib/gcs';
import { Storage } from '@google-cloud/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bucket = process.env.GCS_BUCKET || 'kaccp';
    if (!bucket) {
      return NextResponse.json({ error: 'GCS_BUCKET env not set' }, { status: 400 });
    }
    const prefix = `gs://${bucket}/audio_chunks/${id}/`;
    let uris: string[] = [];
    try {
      uris = await listObjects(prefix);
    } catch (e: any) {
      // Fallback: try direct Storage client listing for better error surfaces
      try {
        const storage = new Storage();
        const { bucket: b, object } = parseGsUri(prefix);
        const [files] = await storage.bucket(b).getFiles({ prefix: object });
        uris = files.map(f => `gs://${b}/${f.name}`);
      } catch (inner: any) {
        const hint = 'Ensure GOOGLE_APPLICATION_CREDENTIALS points to a JSON key with Storage Viewer permissions and that GCS_BUCKET is correct.';
        const message = inner?.message || e?.message || 'failed to list bucket objects';
        return NextResponse.json({ error: `${message}`, hint }, { status: 500 });
      }
    }
    const wavs = uris.filter(u => u.toLowerCase().endsWith('.wav'));

    // derive index from filename like chunk_(\d+).wav or chunk_0000.wav
    const items = await Promise.all(wavs.map(async (uri) => {
      const m = uri.match(/chunk_(\d+)\.(wav|flac|mp3)$/i);
      const raw = m ? parseInt(m[1], 10) : NaN;
      // prefer 1-based index; if files are 0-based, bump by 1
      const index = Number.isFinite(raw) ? (raw === 0 ? 1 : raw) : NaN;
      let url: string | null = null;
      try { url = await getSignedUrl(uri); } catch {
        url = null;
      }
      return { uri, index, url };
    }));

    // sort by inferred index, fallback to uri name
    items.sort((a, b) => {
      if (Number.isFinite(a.index) && Number.isFinite(b.index)) return (a.index as number) - (b.index as number);
      return a.uri.localeCompare(b.uri);
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    const hint = 'Check GCS credentials and bucket name. Also verify network access from your Node environment.';
    return NextResponse.json({ error: e.message ?? 'internal error', hint }, { status: 500 });
  }
}
