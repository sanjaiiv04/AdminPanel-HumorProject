import { createClient } from '@/lib/supabase/server'
import { connection } from 'next/server'

interface VoteRecord {
  id: string
  vote_type: string
  created_at: string
  user_id: string
  generation_id: string
  generations: {
    caption: string | null
    image_url: string
  } | null
}

export default async function AdminRatingsPage() {
    await connection()
    const supabase = await createClient()

  const { data: votes, error } = await supabase
    .from('votes')
    .select('id, vote_type, created_at, user_id, generation_id, generations(caption, image_url)')
    .order('created_at', { ascending: false })
    .limit(150)

  const voteList = (votes as unknown as VoteRecord[]) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-black text-[var(--color-ink)]">
          Ratings & Votes Audit Log
        </h1>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          READ system-wide upvotes and downvotes associated with AI-generated media.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-xs font-bold text-red-600">
          Failed to load ratings: {error.message}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border-[3px] border-[var(--color-ink)] bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b-[3px] border-[var(--color-ink)] bg-[var(--color-skip)] text-xs font-bold uppercase text-[var(--color-ink)]">
            <tr>
              <th className="p-4">Vote Type</th>
              <th className="p-4">Media Target</th>
              <th className="p-4">Voter ID</th>
              <th className="p-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[var(--color-ink)]">
            {voteList.map((v) => (
              <tr key={v.id} className="hover:bg-[var(--color-surface)]">
                <td className="p-4">
                  {v.vote_type === 'up' ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 border border-emerald-300">
                      👍 UPVOTE
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-700 border border-rose-300">
                      👎 DOWNVOTE
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {v.generations?.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.generations.image_url}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-[var(--color-ink)] object-cover"
                      />
                    )}
                    <span className="font-bold text-[var(--color-ink)] truncate max-w-xs">
                      {v.generations?.caption || 'Untitled Generation'}
                    </span>
                  </div>
                </td>
                <td className="p-4 font-mono text-xs font-semibold text-[var(--color-muted)]">
                  {v.user_id}
                </td>
                <td className="p-4 text-xs font-semibold text-[var(--color-muted)]">
                  {new Date(v.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}