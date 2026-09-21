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

// Each API route is deployed as its own serverless function, i.e. its own
// process, so the global cache above cannot be shared *between* routes — only
// within one. The connection budget is therefore:
//
//     routes answering concurrently  x  connection_limit  x  app instances
//
// One dashboard load touches ~7 routes. At Prisma's default pool of
// num_cpus*2+1 that is ~60 connections against a managed database offering ~22,
// which is the P2037 "remaining connection slots are reserved" failure.
//
// So the default here is 1: in a per-request serverless process a larger pool
// buys almost nothing, because the process handles one request at a time.
// Parallel queries inside a route simply queue instead of opening more sockets.
//
// The durable fix is a server-side pooler (DigitalOcean's connection pool /
// PgBouncer), which multiplexes many clients onto few backend connections.
// Point DATABASE_URL at it and add &pgbouncer=true; then raise
// DB_CONNECTION_LIMIT again.
function withPoolLimits(url: string): string {
  if (!url) return url
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '1')
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      // Wait for a free connection instead of failing instantly under a burst.
      parsed.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '20')
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT || '10')
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
