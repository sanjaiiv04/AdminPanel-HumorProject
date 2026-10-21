import { Suspense } from 'react'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function DashboardMetrics() {
  await connection()

  const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: totalGenerations },
    { count: totalVotes },
    { count: upvotesCount },
    { data: topGenerations },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('generations').select('*', { count: 'exact', head: true }),
    supabase.from('votes').select('*', { count: 'exact', head: true }),
    supabase.from('votes').select('*', { count: 'exact', head: true }).eq('vote_type', 'up'),
    supabase
      .from('generations')
      .select('id, caption, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const total = totalVotes ?? 0
  const ups = upvotesCount ?? 0
  const approvalRate = total > 0 ? Math.round((ups / total) * 100) : 0

  return (
    <div className="flex flex-col gap-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Total Users</p>
          <p className="mt-2 font-display text-4xl font-black text-[var(--color-ink)]">
            {totalUsers ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">AI Media Created</p>
          <p className="mt-2 font-display text-4xl font-black text-[var(--color-ink)]">
            {totalGenerations ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Total Votes Cast</p>
          <p className="mt-2 font-display text-4xl font-black text-[var(--color-ink)]">
            {totalVotes ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Approval Sentiment</p>
          <p className="mt-2 font-display text-4xl font-black text-emerald-600">
            {approvalRate}% <span className="text-sm font-bold text-[var(--color-muted)]">upvotes</span>
          </p>
        </div>
      </div>

      {/* Sentiment Progress Bar */}
      <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-ink)]">
          Community Sentiment Split
        </h2>
        <div className="h-6 w-full overflow-hidden rounded-full border-2 border-[var(--color-ink)] bg-rose-100">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${approvalRate}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold">
          <span className="text-emerald-700">👍 Upvotes: {ups}</span>
          <span className="text-rose-700">👎 Downvotes: {total - ups}</span>
        </div>
      </div>

      {/* Recent AI Media Stream */}
      <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-display text-lg font-bold text-[var(--color-ink)]">
          Latest AI Media Generations
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          {(topGenerations ?? []).map((gen) => (
            <div
              key={gen.id}
              className="overflow-hidden rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-surface)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gen.image_url} alt="" className="h-32 w-full object-cover" />
              <p className="p-2 text-xs font-bold truncate text-[var(--color-ink)]">
                {gen.caption || 'No caption'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-200 border-[3px] border-gray-300" />
        ))}
      </div>
      <div className="h-32 rounded-2xl bg-gray-100 border-[3px] border-gray-200" />
      <div className="h-64 rounded-2xl bg-gray-100 border-[3px] border-gray-200" />
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-black text-[var(--color-ink)]">
          System Overview & Metrics
        </h1>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          Real-time metrics and creative statistics across users, media, and engagement.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardMetrics />
      </Suspense>
    </div>
  )
}