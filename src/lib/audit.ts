import 'server-only'
import { headers } from 'next/headers'
import { connectDB } from '@/lib/db'
import { AuditLog } from '@/models/AuditLog'
import type { Types } from 'mongoose'

/**
 * `headers()` throws outside a request scope — background jobs, seed scripts,
 * tests. Request metadata is nice-to-have on an audit row, never a reason to
 * fail the operation being audited.
 */
async function safeHeader(name: string): Promise<string | null> {
  try {
    return headers().get(name)
  } catch {
    return null
  }
}

export async function clientIp(): Promise<string | null> {
  const forwarded = await safeHeader('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return safeHeader('x-real-ip')
}

export async function userAgent(): Promise<string | null> {
  return safeHeader('user-agent')
}

/**
 * Auditing must never break the action it records, so failures are swallowed
 * and logged rather than thrown.
 */
export async function audit(entry: {
  actorId?: Types.ObjectId | string | null
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await connectDB()
    await AuditLog.create({
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip: await clientIp(),
    })
  } catch (err) {
    console.error('[audit] failed to record', entry.action, err)
  }
}
