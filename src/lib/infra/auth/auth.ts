import bcrypt from 'bcryptjs'
import jwt, { SignOptions, Secret } from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import prisma from '@/lib/infra/db/prisma'

import { UserRole } from '@prisma/client'

export type JwtPayload = {
  sub: string // user id
  role: UserRole  // ADMIN | SPEAKER | TRANSCRIBER
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const payload = verifyJwt(token)
  if (!payload) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive) return null
  return user
}

export async function requireAdmin(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || user.role !== 'ADMIN') return null
  return user
}
