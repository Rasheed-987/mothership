import 'server-only'
import { hash, verify } from '@node-rs/argon2'

// @node-rs/argon2 defaults to argon2id at m=19456, t=2, p=1 — the OWASP
// recommendation. Left explicit so a future dependency bump can't quietly
// weaken it.
const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON_OPTIONS)
}

export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON_OPTIONS)
  } catch {
    // Malformed hash in the DB — treat as a failed login, never as a pass.
    return false
  }
}


let decoyHash: string | null = null

export async function equalizeTiming(plaintext: string): Promise<void> {
  decoyHash ??= await hashPassword('decoy-password-never-matches')
  await verifyPassword(decoyHash, plaintext)
}
