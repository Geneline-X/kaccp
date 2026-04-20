import fs from 'fs/promises';
import { Dirent } from 'fs';
import path from 'path';
import type { StorageProvider } from '../provider';

const STORAGE_ROOT = process.env.LOCAL_STORAGE_ROOT || path.join(process.cwd(), '.local-storage');

function uriToPath(uri: string): string {
  const key = uri.startsWith('local://') ? uri.slice('local://'.length) : uri;
  return path.join(STORAGE_ROOT, key);
}

export class LocalStorageProvider implements StorageProvider {
  async getWriteSignedUrl(uri: string, _contentType: string, _expiresInSeconds = 900): Promise<string> {
    const filePath = uriToPath(uri);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const key = uri.startsWith('local://') ? uri.slice('local://'.length) : uri;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/api/storage/upload?key=${encodeURIComponent(key)}`;
  }

  async getSignedUrl(uri: string, _expiresInSeconds = 3600): Promise<string> {
    const key = uri.startsWith('local://') ? uri.slice('local://'.length) : uri;
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/api/storage/file?key=${encodeURIComponent(key)}`;
  }

  async deleteObject(uri: string): Promise<void> {
    try {
      await fs.unlink(uriToPath(uri));
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async downloadBuffer(uri: string): Promise<Buffer> {
    return fs.readFile(uriToPath(uri));
  }

  async uploadBuffer(uri: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = uriToPath(uri);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async listObjects(prefix: string): Promise<string[]> {
    const key = prefix.startsWith('local://') ? prefix.slice('local://'.length) : prefix;
    const dir = path.join(STORAGE_ROOT, key);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true } as any) as unknown as Dirent[];
      return entries
        .filter((e: Dirent) => e.isFile())
        .map((e: Dirent) => `local://${key}/${e.name}`);
    } catch {
      return [];
    }
  }
}
