// Prisma Client singleton.
//
// The global cache must apply in production too, not just in dev. Next.js emits
// each API route as its own server chunk, and every chunk that imports this
// module gets a fresh module instance — so caching only outside production means
// one PrismaClient (and one connection pool) *per route*. Seven routes answering
// a single dashboard load is then ~7 pools against a database that allows ~25
// connections total, which surfaces as:
//   FATAL: remaining connection slots are reserved for roles with SUPERUSER
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Prisma's default pool is num_cpus*2+1 per client, which is far too generous
// when several app instances share a small managed database. Pin it explicitly
// rather than relying on whoever set DATABASE_URL to have thought about it.
function withPoolLimits(url: string): string {
  if (!url) return url
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '5')
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      // Wait for a free connection instead of failing instantly under a burst.
      parsed.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function createClient(): PrismaClient {
  const url = withPoolLimits(process.env.DATABASE_URL || '')
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

// Cache in every environment. See the note above: skipping this in production is
// what exhausts the connection pool.
globalForPrisma.prisma = prisma

export default prisma
