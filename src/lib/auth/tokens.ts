import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * 32 bytes of CSPRNG entropy. Opaque and random, never a JWT: an opaque token
 * can be revoked server-side by deleting one row, which a self-contained signed
 * token cannot.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Only the hash is ever persisted, for sessions and invite links alike. sha256
 * is right here (unlike for passwords) because the input already has 256 bits
 * of entropy — there is nothing to brute-force and no need to be slow.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Invite links carry `<id>.<token>` so we can look up by id, then verify by hash. */
export function packInviteToken(id: string, token: string): string {
  return `${id}.${token}`
}

export function unpackInviteToken(value: string): { id: string; token: string } | null {
  const separator = value.indexOf('.')
  if (separator <= 0 || separator === value.length - 1) return null
  return { id: value.slice(0, separator), token: value.slice(separator + 1) }
}
