import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AuthorizationError } from '@/lib/authz'
import { ServiceError } from '@/lib/services/roles'


export function apiError(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message, field: err.field }, { status: err.status })
  }
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: 'Forbidden', permission: err.permission }, { status: 403 })
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: err.flatten().fieldErrors }, { status: 422 })
  }
  // requireAuth() redirects unauthenticated page requests; in an API context
  // that surfaces as a thrown NEXT_REDIRECT, which should be a 401 instead.
  if (err && typeof err === 'object' && 'digest' in err && String(err.digest).startsWith('NEXT_REDIRECT')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  console.error('[api]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ServiceError('Request body must be valid JSON.', 400)
  }
}
