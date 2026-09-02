import 'server-only'

/**
 * Fixed-window limiter, in process memory.
 *
 * This is per-instance: it slows down a single attacker against a single
 * server, and does nothing across a horizontally scaled deployment. Before
 * production, move the counter to Mongo or Redis so the window is shared.
 */
type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }

  existing.count += 1
  if (existing.count > limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now }
  }
  return { ok: true, retryAfterMs: 0 }
}

export function clearRateLimit(key: string): void {
  windows.delete(key)
}

// Keep the map from growing without bound in a long-lived dev server.
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of windows) if (win.resetAt <= now) windows.delete(key)
}, 60_000).unref?.()
