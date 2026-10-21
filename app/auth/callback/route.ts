import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Get true origin from Vercel/Next.js headers or fallback to URL origin
  const host = request.headers.get('x-forwarded-host') || requestUrl.host
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const origin = `${protocol}://${host}`

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Query superadmin status
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superadmin')
          .eq('id', user.id)
          .single()

        // IF NOT SUPERADMIN: Sign out completely and pass ?error=unauthorized
        if (!profile?.is_superadmin) {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=unauthorized`)
        }

        // IF SUPERADMIN: Proceed to dashboard
        return NextResponse.redirect(`${origin}/admin/users`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=unauthorized`)
}