import { Suspense } from 'react'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  created_at?: string | null
  uni?: string | null
  is_superadmin?: boolean | null
  bio?: string | null
  phone?: string | null
  location?: string | null
  date_of_birth?: string | null
  generations_count?: number | null
  votes_cast?: number | null
  upvotes_cast?: number | null
}

async function UsersList() {
  await connection()

  const supabase = await createClient()

  const { data: users } = await supabase.rpc('admin_list_users', {
    p_limit: 100,
    p_offset: 0,
  })

  const userList = (users ?? []) as AdminUser[]

  if (userList.length === 0) {
    return (
      <div className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-8 text-center shadow-sm">
        <p className="font-display text-lg font-bold text-[var(--color-ink)]">No users found</p>
        <p className="text-xs font-medium text-[var(--color-muted)]">Check back later or verify your database connection.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border-[3px] border-[var(--color-ink)] bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b-[3px] border-[var(--color-ink)] bg-[var(--color-surface)] font-display text-xs uppercase font-extrabold text-[var(--color-ink)]">
          <tr>
            <th className="px-6 py-4">User</th>
            <th className="px-6 py-4">UNI</th>
            <th className="px-6 py-4">Role</th>
            <th className="px-6 py-4">Generations</th>
            <th className="px-6 py-4">Votes</th>
            <th className="px-6 py-4">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-[var(--color-ink)] font-medium">
          {userList.map((user) => {
            const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous User'
            const initials = name.slice(0, 2).toUpperCase()

            return (
              <tr key={user.id} className="hover:bg-amber-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={user.avatar_url}
                        alt={name}
                        className="h-10 w-10 rounded-full border-2 border-[var(--color-ink)] object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-lavender)] font-display text-xs font-extrabold">
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-[var(--color-ink)]">{name}</p>
                      <p className="text-xs text-[var(--color-muted)] truncate max-w-[180px]">{user.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="rounded-md border-2 border-[var(--color-ink)] bg-[var(--color-surface)] px-2 py-1 text-xs font-bold">
                    {user.uni || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.is_superadmin ? (
                    <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-3 py-1 text-xs font-black uppercase text-[var(--color-ink)]">
                      Superadmin
                    </span>
                  ) : (
                    <span className="rounded-full border-2 border-[var(--color-ink)] bg-gray-100 px-3 py-1 text-xs font-bold text-[var(--color-muted)]">
                      User
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 font-display font-bold text-[var(--color-ink)]">
                  {user.generations_count ?? 0}
                </td>
                <td className="px-6 py-4 font-display font-bold text-[var(--color-ink)]">
                  {user.votes_cast ?? 0}
                </td>
                <td className="px-6 py-4 text-xs font-semibold text-[var(--color-muted)]">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function UsersTableSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4">
      <div className="h-12 rounded-xl bg-gray-200" />
      <div className="h-64 rounded-xl bg-gray-100" />
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-black text-[var(--color-ink)]">
          User Management
        </h1>
        <p className="text-sm font-medium text-[var(--color-muted)]">
          View and manage account privileges across the platform.
        </p>
      </div>

      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersList />
      </Suspense>
    </div>
  )
}