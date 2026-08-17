import { type NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // /roster runs its own separate cookie-based auth (see app/roster/lib/auth.ts)
  // and has no use for Supabase Auth session refresh — excluded so its requests
  // don't take on an extra Supabase round trip and risk surface for nothing.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|roster|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
