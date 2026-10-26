'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageTransition from '@/components/page-transition'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navGroups = [
    { label: 'Overview', items: [
      { label: 'Analytics', href: '/admin' },
      { label: 'Users', href: '/admin/users' },
      { label: 'AI Media', href: '/admin/media' },
      { label: 'Ratings', href: '/admin/ratings' },
    ] },
    { label: 'Prompt configuration', items: [
      { label: 'Prompt chains', href: '/admin/prompt-chains' }, { label: 'Chain steps', href: '/admin/prompt-chain-steps' }, { label: 'Chain mix', href: '/admin/prompt-chain-mix' },
    ] },
    { label: 'Generation & content', items: [
      { label: 'Generation requests', href: '/admin/generation-requests' }, { label: 'LLM responses', href: '/admin/llm-responses' },
      { label: 'Terms', href: '/admin/terms' }, { label: 'Generation examples', href: '/admin/generation-examples' },
    ] },
    { label: 'Models & signup access', items: [
      { label: 'Models & providers', href: '/admin/models-providers' },
      { label: 'Signup access', href: '/admin/signup-access' },
    ] },
  ] satisfies { label: string; items: { label: string; href?: string }[] }[]

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)]">
      {/* Neubrutalist Header */}
      <header className="border-b-[3px] border-[var(--color-ink)] bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(open => !open)}
              aria-expanded={sidebarOpen}
              aria-controls="admin-sidebar"
              className="flex items-center gap-2 rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-surface)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-skip)]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
                <path d={sidebarOpen ? 'm16 9-3 3 3 3' : 'm13 9 3 3-3 3'} />
              </svg>
              {sidebarOpen ? 'Hide menu' : 'Show menu'}
            </button>
            <span className="font-display text-2xl font-black tracking-tight text-[var(--color-ink)]">
              🛡️ CapRate <span className="text-xs uppercase tracking-widest text-[var(--color-muted)]">Admin</span>
            </span>

          </div>

          <button
            onClick={handleSignOut}
            className="sticker rounded-xl bg-[var(--color-dislike)] px-4 py-2 font-display text-xs font-black uppercase text-white"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className={`mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-6 ${sidebarOpen ? 'md:grid-cols-[240px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        <aside id="admin-sidebar" hidden={!sidebarOpen} className="self-start rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-4">
          <nav aria-label="Admin sections" className="space-y-5">
            {navGroups.map(group => (
              <div key={group.label}>
                <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{group.label}</h2>
                <ul className="space-y-1">
                  {group.items.map(item => {
                    const href = 'href' in item ? item.href : undefined
                    const active = href && (pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)) || (href === '/admin/models-providers' && (pathname.startsWith('/admin/llm-models') || pathname.startsWith('/admin/llm-providers'))))
                    return (
                      <li key={item.label}>
                        {href ? (
                          <Link href={href} aria-current={active ? 'page' : undefined} className={`block rounded-lg border-2 px-3 py-2 text-sm font-bold ${active ? 'border-[var(--color-ink)] bg-[var(--color-skip)]' : 'border-transparent hover:bg-[var(--color-bg)]'}`}>
                            {item.label}
                          </Link>
                        ) : (
                          <span aria-disabled="true" className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--color-muted)]">
                            <span>{item.label}</span><span className="shrink-0 text-[10px]">Coming soon</span>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
