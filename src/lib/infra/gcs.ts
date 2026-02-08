import { Storage } from '@google-cloud/storage';

// Prefer inline credentials when provided to avoid host-specific ADC issues.
// Supported envs:
// - GCS_CREDENTIALS_B64: base64-encoded JSON of a service account key
// - GCS_CREDENTIALS_JSON: raw JSON string (single line) of a service account key
// Fallbacks:
// - GOOGLE_APPLICATION_CREDENTIALS -> ADC
// - Default ADC (Workload Identity, user creds) – may fail to sign URLs
let _storage: Storage | null = null;
function getStorage(): Storage {
  if (_storage) return _storage;
  try {
    const b64 = process.env.GCS_CREDENTIALS_B64;
    const raw = process.env.GCS_CREDENTIALS_JSON || process.env.GCS_SERVICE_ACCOUNT_JSON;
    let creds: any | null = null;
    if (b64) {
      const json = Buffer.from(b64, 'base64').toString('utf-8');
      creds = JSON.parse(json);
    } else if (raw) {
      creds = JSON.parse(raw);
    }
    if (creds && creds.client_email && creds.private_key) {
      _storage = new Storage({ credentials: creds, projectId: creds.project_id });
      return _storage;
    }
  } catch (e) {
    // fall through to ADC
  }
  _storage = new Storage();
  return _storage;
}

export async function getSignedUrl(gsUri: string, expiresInSeconds = 3600): Promise<string> {
  if (!gsUri || !gsUri.startsWith('gs://')) throw new Error('invalid gs uri');
  const withoutScheme = gsUri.slice('gs://'.length);
  const parts = withoutScheme.split('/');
  const bucketName = parts.shift();
  if (!bucketName) throw new Error('invalid gs uri - missing bucket');
  const objectName = parts.join('/');
  if (!objectName) throw new Error('invalid gs uri - missing object');

  try {
    const storage = getStorage();
    const [url] = await storage
      .bucket(bucketName)
      .file(objectName)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInSeconds * 1000,
      });
    return url;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (/client_email/i.test(msg)) {
      throw new Error('Cannot sign URL: credentials missing client_email/private_key. Provide a service account JSON via GCS_CREDENTIALS_JSON or GCS_CREDENTIALS_B64.');
    }
    throw err;
  }
}

export function parseGsUri(gsUri: string): { bucket: string; object: string } {
  if (!gsUri || !gsUri.startsWith('gs://')) throw new Error('invalid gs uri');
  const withoutScheme = gsUri.slice('gs://'.length);
  const parts = withoutScheme.split('/');
  const bucket = parts.shift();
  if (!bucket) throw new Error('invalid gs uri - missing bucket');
  const object = parts.join('/');
  if (!object) throw new Error('invalid gs uri - missing object');
  return { bucket, object };
}

export async function deleteObject(gsUri: string): Promise<void> {
  const { bucket, object } = parseGsUri(gsUri);
  const storage = getStorage();
  await storage.bucket(bucket).file(object).delete({ ignoreNotFound: true });
}

export async function listObjects(gsPrefix: string): Promise<string[]> {
  // Accept either gs://bucket/prefix or bucket/prefix. Return absolute gs:// URIs.
  let bucket: string | undefined;
  let prefix: string;
  if (gsPrefix.startsWith('gs://')) {
    const { bucket: b, object } = parseGsUri(gsPrefix.endsWith('/') ? gsPrefix : gsPrefix + '/');
    bucket = b;
    prefix = object;
  } else {
    const parts = gsPrefix.split('/');
    bucket = parts.shift();
    prefix = parts.join('/');
  }
  if (!bucket) throw new Error('missing bucket');
  const storage = getStorage();
  const [files] = await storage.bucket(bucket).getFiles({ prefix });
  return files.map(f => `gs://${bucket}/${f.name}`);
}
