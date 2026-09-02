import 'server-only'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/db'
import { env, isProduction } from '@/lib/env'
import { Session } from '@/models/Session'
import { generateToken, hashToken } from './tokens'
import type { Types } from 'mongoose'

export const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
/** Don't write to Mongo on every single request just to touch lastUsedAt. */
const LAST_USED_THROTTLE_MS = 60 * 60 * 1000

type SessionContext = { ip?: string | null; userAgent?: string | null }

/**
 * Note: `cookies()` is only writable inside a Server Action or Route Handler.
 * Calling this from a Server Component will throw — that is Next's rule, not ours.
 */
export async function createSession(userId: Types.ObjectId | string, ctx: SessionContext = {}): Promise<void> {
  await connectDB()

  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    lastUsedAt: new Date(),
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  })

  const cookieStore = cookies()
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/** Resolves the cookie to a live session row, or null. Read-only — safe anywhere. */
export async function readSession() {
  const cookieStore = cookies()
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value
  if (!token) return null

  await connectDB()

  const session = await Session.findOne({ tokenHash: hashToken(token) }).lean()
  if (!session) return null

  // Belt and braces: the TTL index reaps expired rows, but only every ~60s.
  if (session.expiresAt.getTime() <= Date.now()) return null

  if (Date.now() - session.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    void Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {})
  }

  return session
}

export async function destroySession(): Promise<void> {
  const cookieStore = cookies()
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value

  if (token) {
    await connectDB()
    await Session.deleteOne({ tokenHash: hashToken(token) })
  }

  cookieStore.delete(env.SESSION_COOKIE_NAME)
}

/** Used on password change and when suspending a member — kills every device. */
export async function destroyAllSessions(userId: Types.ObjectId | string): Promise<void> {
  await connectDB()
  await Session.deleteMany({ userId })
}
