import bcrypt from 'bcryptjs'
import jwt, { SignOptions, Secret } from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import prisma from '@/lib/infra/db/prisma'

import { UserRole } from '@prisma/client'
import { cached, invalidate } from '@/lib/infra/cache'

export type JwtPayload = {
  sub: string // user id
  role: UserRole  // ADMIN | SPEAKER | TRANSCRIBER
  availableRoles?: UserRole[]
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signJwt(payload: JwtPayload, expiresIn: string | number = '7d') {
  const secret = getJwtSecret() as unknown as Secret
   
  const options: SignOptions = { algorithm: 'HS256', expiresIn: expiresIn as any }
  return jwt.sign(payload, secret, options)
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret() as unknown as Secret) as JwtPayload
  } catch {
    return null
  }
}

/* Every authenticated request resolves the caller, so this lookup runs more than
 * any other query in the app — several times per page load once the dashboard
 * fans out. Each API route is a serverless process with a small pool, so under
 * load these alone can exhaust the database's connection slots and take down
 * login along with everything else.
 *
 * A short TTL keeps it correct enough: the JWT is already the authority on who
 * the caller is, and this only re-reads their row. The window is small so a
 * deactivated account stops working within seconds rather than on the next
 * request.
 */
const USER_CACHE_MS = Number(process.env.AUTH_CACHE_MS || 15_000)

export async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const payload = verifyJwt(token)
  if (!payload) return null

  const user = await cached(`user:${payload.sub}`, USER_CACHE_MS, () =>
    prisma.user.findUnique({ where: { id: payload.sub } })
  )
  if (!user || !user.isActive) return null
  return user
}

/** Drop a cached user immediately — call after changing their row. */
export function invalidateAuthUser(userId: string): void {
  invalidate(`user:${userId}`)
}

export async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || user.role !== 'ADMIN') return null
  return user
}
