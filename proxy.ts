// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth')

  if (isAuthCallback) {
    return supabaseResponse
  }

  // 1. Redirect unauthenticated users to /login
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Check superadmin status if user is logged in
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single()

    // IF NOT SUPERADMIN: Force sign out and redirect to /login with error param
    if (!profile?.is_superadmin) {
      await supabase.auth.signOut()
      if (!isLoginPage || !request.nextUrl.searchParams.has('error')) {
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
      }
      return supabaseResponse
    }

    // IF SUPERADMIN & visits /login: Redirect to /admin/users directly
    if (isLoginPage) {
      return NextResponse.redirect(new URL('/admin/users', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}