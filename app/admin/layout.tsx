'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageTransition from '@/components/page-transition'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Analytics', href: '/admin', color: 'bg-[var(--color-skip)]' },
    { label: 'Users', href: '/admin/users', color: 'bg-[var(--color-lavender)]' },
    { label: 'AI Media', href: '/admin/media', color: 'bg-[var(--color-like)]' },
    { label: 'Ratings', href: '/admin/ratings', color: 'bg-[var(--color-focus)]' },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      {/* Neubrutalist Header */}
      <header className="border-b-[3px] border-[var(--color-ink)] bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-display text-2xl font-black tracking-tight text-[var(--color-ink)]">
              🛡️ CapRate <span className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Admin</span>
            </span>
            <nav className="flex gap-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-4 py-2 text-sm font-extrabold border-[3px] border-[var(--color-ink)] transition-all ${
                      isActive
                        ? `${item.color} shadow-[3px_3px_0px_0px_var(--color-ink)] translate-x-[-1px] translate-y-[-1px]`
                        : 'bg-white hover:bg-[var(--color-bg)] text-[var(--color-ink)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <button
            onClick={handleSignOut}
            className="sticker rounded-xl bg-[var(--color-dislike)] px-4 py-2 font-display text-xs font-black uppercase text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content View with Transition */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}