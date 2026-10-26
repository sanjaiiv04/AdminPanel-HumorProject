'use client'

import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  // Ensure any cached non-superadmin session is completely wiped when returning with an error
  useEffect(() => {
    if (errorParam) {
      const supabase = createClient()
      void supabase.auth.signOut()
    }
  }, [errorParam])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Force account picker so users can select a different Google account if needed
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (error) {
      console.error('Login error:', error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="sticker w-full max-w-md rounded-2xl bg-white p-8">
        
        {/* Neubrutalist Popup Error Banner */}
        {errorParam === 'unauthorized' && (
  <div className="sticker mb-6 rounded-xl bg-[var(--color-dislike)] p-4 text-white shadow-md">
    <div className="flex items-start gap-3">
      <span className="text-xl">🚫</span>
      <div>
        <h3 className="font-display text-sm font-black uppercase tracking-wide">
          Access Denied
        </h3>
        <p className="mt-1 text-xs font-bold leading-relaxed opacity-95">
          This account does not have superadmin privileges. Please sign in with an authorized account.
        </p>
      </div>
    </div>
  </div>
)}

        <div className="text-center">
          <h1 className="font-display text-3xl font-black text-[var(--color-ink)]">
            Admin Portal
          </h1>
          <p className="mt-2 text-xs font-bold text-[var(--color-muted)]">
            Superadmin access required to manage CapRate.
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="sticker mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--color-skip)] px-4 py-3 font-display text-sm font-black text-[var(--color-ink)] uppercase tracking-wide hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>🔑</span> {loading ? 'Redirecting to Google...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)]" />}>
      <LoginContent />
    </Suspense>
  )
}
