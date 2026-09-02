import { NextResponse, type NextRequest } from 'next/server'

/**
 * Runs on the Edge runtime in Next 14, so it must stay dependency-free.
 *
 * This is an OPTIMISTIC check only — it looks for the presence of a session
 * cookie and nothing more. It never touches the database, because it runs on
 * every request including prefetches, and a query here would be paid for on
 * navigations the user never makes.
 *
 * A cookie being present does NOT mean the session is valid. The real gate is
 * `requirePermission()` in src/lib/dal.ts, which runs next to the data.
 */
const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'mothership_session'

const PROTECTED_PREFIXES = ['/dashboard']
const AUTH_PAGES = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSessionCookie = Boolean(request.cookies.get(COOKIE)?.value)

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isAuthPage = AUTH_PAGES.includes(pathname)

  if (isProtected && !hasSessionCookie) {
    const url = new URL('/login', request.url)
    // Preserve where they were headed so login can send them back.
    if (pathname !== '/dashboard') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)'],
}
