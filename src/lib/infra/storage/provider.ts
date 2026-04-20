export interface StorageProvider {
  getWriteSignedUrl(uri: string, contentType: string, expiresInSeconds?: number): Promise<string>;
  getSignedUrl(uri: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(uri: string): Promise<void>;
  downloadBuffer(uri: string): Promise<Buffer>;
  uploadBuffer(uri: string, buffer: Buffer, contentType: string): Promise<void>;
  listObjects(prefix: string): Promise<string[]>;
}
