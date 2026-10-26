import { Suspense } from 'react'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AdminNotice, AdminPageHeader, AdminPagination, AdminTable, type AdminColumn } from '@/components/admin/ui'
import { FormattedDate } from './user-date'

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

const PAGE_SIZE = 25

type UsersSearchParams = Promise<{ page?: string | string[] }>

async function UsersList({ searchParams }: { searchParams: UsersSearchParams }) {
  await connection()
  const rawPage = (await searchParams).page
  const parsedPage = typeof rawPage === 'string' && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1
  // Keep offsets within PostgreSQL's integer range.
  const page = Number.isSafeInteger(parsedPage) && parsedPage <= Math.floor(2_147_483_647 / PAGE_SIZE) ? parsedPage : 1
  const offset = (page - 1) * PAGE_SIZE
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_limit: PAGE_SIZE + 1,
    p_offset: offset,
  })

  if (error) {
    return <AdminNotice title="Unable to load users" error><p>{error.message}</p><Link href={`/admin/users?page=${page}`} className="mt-3 inline-block font-bold underline">Try again</Link></AdminNotice>
  }

  const users = (data ?? []) as AdminUser[]
  const visibleUsers = users.slice(0, PAGE_SIZE)
  const columns: AdminColumn<AdminUser>[] = [
    { key: 'user', label: 'User', render: user => {
      const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous User'
      return <div className="flex items-center gap-3">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full border-2 border-[var(--color-ink)] object-cover" />
        ) : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-lavender)] text-xs font-extrabold">{name.slice(0, 2).toUpperCase()}</span>}
        <div><p className="font-bold">{name}</p><p className="max-w-[180px] truncate text-xs text-[var(--color-muted)]" title={user.id}>{user.id}</p></div>
      </div>
    } },
    { key: 'uni', label: 'UNI', render: user => user.uni || 'N/A' },
    { key: 'role', label: 'Role', render: user => <span className={`whitespace-nowrap rounded-full border-2 border-[var(--color-ink)] px-3 py-1 text-xs font-bold ${user.is_superadmin ? 'bg-[var(--color-skip)]' : 'bg-gray-100'}`}>{user.is_superadmin ? 'Superadmin' : 'User'}</span> },
    { key: 'generations', label: 'Generations', render: user => user.generations_count ?? 0 },
    { key: 'votes', label: 'Votes', render: user => user.votes_cast ?? 0 },
    { key: 'joined', label: 'Joined (UTC)', render: user => <FormattedDate dateString={user.created_at} /> },
  ]

  return <div className="space-y-4">
    {visibleUsers.length ? <AdminTable caption="User accounts and activity" columns={columns} rows={visibleUsers} rowKey={user => user.id} /> : (
      <AdminNotice title={page === 1 ? 'No users found' : 'No users on this page'}>
        {page === 1 ? 'No user accounts were returned.' : <Link href="/admin/users" className="font-bold underline">Return to the first page</Link>}
      </AdminNotice>
    )}
    <AdminPagination page={page} previousHref={page > 1 ? `/admin/users?page=${page - 1}` : undefined} nextHref={users.length > PAGE_SIZE ? `/admin/users?page=${page + 1}` : undefined}>
      {visibleUsers.length ? `Showing users ${offset + 1}–${offset + visibleUsers.length}` : '0 users shown'}
    </AdminPagination>
  </div>
}

function UsersTableSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4">
      <div className="h-12 rounded-xl bg-gray-200" />
      <div className="h-64 rounded-xl bg-gray-100" />
    </div>
  )
}

export default function AdminUsersPage({ searchParams }: { searchParams: UsersSearchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="User Management" description="View user accounts, roles, and activity. Up to 25 users per page." />
      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersList searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
