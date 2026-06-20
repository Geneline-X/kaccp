import crypto from "crypto";
import { prisma } from "@/lib/infra/db/prisma";

const KEY_PREFIX = "kaccp_sk_";
const KEY_BYTES = 32; // 64 hex chars

export function generateApiKey(name: string): { raw: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(KEY_BYTES).toString("hex");
  const raw = `${KEY_PREFIX}${random}`;
  const hash = hashKey(raw);
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function verifyApiKey(authHeader: string | null): Promise<{ valid: boolean; name?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false };
  }

  const token = authHeader.slice(7).trim();
  if (!token || !token.startsWith(KEY_PREFIX)) {
    return { valid: false };
  }

  const hash = hashKey(token);
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, name: true, isActive: true },
  });

  if (!key || !key.isActive) {
    return { valid: false };
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return { valid: true, name: key.name };
}
