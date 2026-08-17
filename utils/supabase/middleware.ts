import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Every /admin route is leader-only; /admin/login is the one exception so
// there's somewhere to sign in from.
function isProtectedAdminPath(pathname: string) {
  return pathname.startsWith('/admin') && pathname !== '/admin/login'
}

function redirectPreservingCookies(url: URL, supabaseResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  return redirectResponse
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Middleware runs on almost every request across the whole site — if it
  // throws, Vercel reports "This Routing Middleware has crashed" and takes
  // the entire site down, not just whatever needed Supabase. Never let a
  // missing/misconfigured env var (e.g. not yet added in the Vercel
  // dashboard — .env.local never deploys) do that.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — skipping session refresh.')
    // Without Supabase configured there's no way to verify a session — fail
    // closed on the admin boundary rather than letting requests through.
    if (isProtectedAdminPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Do not add logic between createServerClient and getUser() — that gap
    // is where sessions get silently refreshed and users randomly logged out.
    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    if (isProtectedAdminPath(pathname) && !user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return redirectPreservingCookies(loginUrl, supabaseResponse)
    }

    if (pathname === '/admin/login' && user) {
      return redirectPreservingCookies(new URL('/admin', request.url), supabaseResponse)
    }
  } catch (err) {
    console.error('[middleware] Supabase session refresh failed, continuing without it:', err)
    // Same fail-closed rule as the missing-env-var case above: if we can't
    // verify a session, admin stays locked rather than left open.
    if (isProtectedAdminPath(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return supabaseResponse
}
