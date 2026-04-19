import { Storage } from '@google-cloud/storage';
import type { StorageProvider } from '../provider';

let _storage: Storage | null = null;
function getStorage(): Storage {
  if (_storage) return _storage;
  try {
    const b64 = process.env.GCS_CREDENTIALS_B64;
    const raw = process.env.GCS_CREDENTIALS_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON;
    let creds: any | null = null;
    if (b64) {
      creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    } else if (raw) {
      creds = JSON.parse(raw);
    }
    if (creds?.client_email && creds?.private_key) {
      _storage = new Storage({ credentials: creds, projectId: creds.project_id });
      return _storage;
    }
  } catch {
    // fall through to ADC
  }
  _storage = new Storage();
  return _storage;
}

function parseUri(uri: string): { bucket: string; object: string } {
  if (!uri.startsWith('gs://')) throw new Error(`Invalid GCS URI: ${uri}`);
  const withoutScheme = uri.slice('gs://'.length);
  const parts = withoutScheme.split('/');
  const bucket = parts.shift();
  if (!bucket) throw new Error('Missing bucket in GCS URI');
  const object = parts.join('/');
  if (!object) throw new Error('Missing object in GCS URI');
  return { bucket, object };
}

export class GCSStorageProvider implements StorageProvider {
  async getWriteSignedUrl(uri: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    const { bucket, object } = parseUri(uri);
    const [url] = await getStorage()
      .bucket(bucket)
      .file(object)
      .getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + expiresInSeconds * 1000, contentType });
    return url;
  }

  async getSignedUrl(uri: string, expiresInSeconds = 3600): Promise<string> {
    const { bucket, object } = parseUri(uri);
    try {
      const [url] = await getStorage()
        .bucket(bucket)
        .file(object)
        .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + expiresInSeconds * 1000 });
      return url;
    } catch (err: any) {
      if (/client_email/i.test(String(err?.message))) {
        throw new Error('Cannot sign URL: provide service account credentials via GCS_CREDENTIALS_JSON or GCS_CREDENTIALS_B64.');
      }
      throw err;
    }
  }

  async deleteObject(uri: string): Promise<void> {
    const { bucket, object } = parseUri(uri);
    await getStorage().bucket(bucket).file(object).delete({ ignoreNotFound: true });
  }

  async downloadBuffer(uri: string): Promise<Buffer> {
    const { bucket, object } = parseUri(uri);
    const [data] = await getStorage().bucket(bucket).file(object).download();
    return data as Buffer;
  }

  async uploadBuffer(uri: string, buffer: Buffer, contentType: string): Promise<void> {
    const { bucket, object } = parseUri(uri);
    await getStorage().bucket(bucket).file(object).save(buffer, { contentType, resumable: false });
  }

  async listObjects(prefix: string): Promise<string[]> {
    let bucket: string;
    let pfx: string;
    if (prefix.startsWith('gs://')) {
      const parsed = parseUri(prefix.endsWith('/') ? prefix : prefix + '/');
      bucket = parsed.bucket;
      pfx = parsed.object;
    } else {
      const parts = prefix.split('/');
      bucket = parts.shift()!;
      pfx = parts.join('/');
    }
    const [files] = await getStorage().bucket(bucket).getFiles({ prefix: pfx });
    return files.map(f => `gs://${bucket}/${f.name}`);
  }
}
