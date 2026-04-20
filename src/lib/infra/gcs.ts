export {
  getWriteSignedUrl,
  getSignedUrl,
  deleteObject,
  downloadBuffer,
  uploadBuffer,
  listObjects,
} from './storage/index';

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
