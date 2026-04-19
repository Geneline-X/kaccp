import type { StorageProvider } from './provider';

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;
  const providerName = process.env.STORAGE_PROVIDER || 'gcs';
  if (providerName === 'local') {
    const { LocalStorageProvider } = require('./providers/local-provider');
    _provider = new LocalStorageProvider();
  } else {
    const { GCSStorageProvider } = require('./providers/gcs-provider');
    _provider = new GCSStorageProvider();
  }
  return _provider!;
}

export function getWriteSignedUrl(uri: string, contentType: string, expiresInSeconds?: number): Promise<string> {
  return getStorageProvider().getWriteSignedUrl(uri, contentType, expiresInSeconds);
}

export function getSignedUrl(uri: string, expiresInSeconds?: number): Promise<string> {
  return getStorageProvider().getSignedUrl(uri, expiresInSeconds);
}

export function deleteObject(uri: string): Promise<void> {
  return getStorageProvider().deleteObject(uri);
}

export function downloadBuffer(uri: string): Promise<Buffer> {
  return getStorageProvider().downloadBuffer(uri);
}

export function uploadBuffer(uri: string, buffer: Buffer, contentType: string): Promise<void> {
  return getStorageProvider().uploadBuffer(uri, buffer, contentType);
}

export function listObjects(prefix: string): Promise<string[]> {
  return getStorageProvider().listObjects(prefix);
}

export type { StorageProvider } from './provider';
