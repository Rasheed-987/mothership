import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal'
import { apiError } from '../_helpers'

/**
 * GET /api/me — the signed-in user and their resolved permissions.
 *
 * Useful for confirming the whole chain works: cookie → session → user →
 * roles → union of permissions.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ user })
  } catch (err) {
    return apiError(err)
  }
}
