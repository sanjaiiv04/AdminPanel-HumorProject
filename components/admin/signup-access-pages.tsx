import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isResourceId, resourcePage, RESOURCE_PAGE_SIZE, type ResourceSearchParams } from '@/lib/admin/read-resources'
import { isSignupKind, signupDefinitions, signupHref, type SignupEntry, type SignupKind } from '@/lib/admin/signup-access'
import { SignupAccessForm, DeleteSignupAccessForm } from './signup-access-forms'
import { AdminDetails, AdminNotice, AdminPageHeader, AdminPagination, AdminTable, type AdminColumn } from './ui'

const linkClass = 'text-sm font-bold underline underline-offset-2'
const LoadingSignup = () => <div role="status" className="rounded-xl bg-white p-6 text-sm">Loading signup lists…</div>

function EnforcementNotice() {
  return <AdminNotice title="Additive signup access">Columbia UNI emails remain allowed. After the signup-access migration and CapRate update are deployed, active domains and exact whitelisted emails also qualify at signup and sign-in. Removing an entry affects future sign-ins; it does not revoke existing sessions. These lists never grant admin access.</AdminNotice>
}

function QueryError({ message, href }: { message: string; href: string }) {
  return <AdminNotice title="Unable to load signup entries" error><p>{message}</p><a className={`${linkClass} mt-3 inline-block`} href={href}>Try again</a></AdminNotice>
}

async function SignupAccessList({ searchParams }: { searchParams: ResourceSearchParams }) {
  await connection()
  const params = await searchParams
  const kind: SignupKind = params.tab === 'emails' ? 'emails' : 'domains'
  const definition = signupDefinitions[kind]
  const page = resourcePage(params.page)
  const offset = (page - 1) * RESOURCE_PAGE_SIZE
  const supabase = await createClient()
  const { data, error } = await supabase.from(definition.table).select(definition.select)
    .order(definition.field).order('id').range(offset, offset + RESOURCE_PAGE_SIZE)
    .overrideTypes<SignupEntry[], { merge: false }>()
  const entries = data ?? []
  const columns: AdminColumn<SignupEntry>[] = [
    { key: 'value', label: kind === 'domains' ? 'Domain' : 'Email address', render: entry => <Link className={`${linkClass} break-all`} href={`/admin/signup-access/${kind}/${entry.id}/edit`}>{entry[definition.field]}</Link> },
    ...(kind === 'emails' ? [{ key: 'note', label: 'Note', render: (entry: SignupEntry) => <p className="line-clamp-3 max-w-sm whitespace-pre-wrap break-words">{entry.note || '—'}</p> }] : []),
    { key: 'active', label: 'Active', render: entry => entry.is_active ? 'Yes' : 'No' },
    { key: 'actions', label: 'Actions', render: entry => <div className="flex gap-4"><Link className={linkClass} href={`/admin/signup-access/${kind}/${entry.id}/edit`}>Edit</Link><Link className={`${linkClass} text-rose-700`} href={`/admin/signup-access/${kind}/${entry.id}/delete`}>Delete</Link></div> },
  ]
  return <div className="space-y-5">
    <nav aria-label="Signup lists" className="flex flex-wrap gap-3">
      {(['domains', 'emails'] as const).map(tab => <Link key={tab} href={signupHref(tab)} aria-current={kind === tab ? 'page' : undefined} className={`rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold ${kind === tab ? 'bg-[var(--color-skip)]' : 'bg-white'}`}>{signupDefinitions[tab].title}</Link>)}
    </nav>
    {error ? <QueryError message={error.message} href={signupHref(kind, { page: String(page) })} /> : <>
      {params.saved === '1' && <AdminNotice title="Signup list entry saved" />}
      {params.deleted === '1' && <AdminNotice title="Signup list entry removed" />}
      <Link href={`/admin/signup-access/${kind}/new`} className="inline-block rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold">Add {definition.noun}</Link>
      {entries.length ? <AdminTable caption={definition.title} rows={entries.slice(0, RESOURCE_PAGE_SIZE)} columns={columns} rowKey={entry => entry.id} /> : <AdminNotice title={page > 1 ? 'No entries on this page' : `No ${kind === 'domains' ? 'allowed domains' : 'whitelisted emails'} yet`}>
        {page > 1 ? <Link href={signupHref(kind)} className={linkClass}>Return to the first page</Link> : `Add ${kind === 'domains' ? 'a domain' : 'an email address'} to maintain this list.`}
      </AdminNotice>}
      <AdminPagination page={page} previousHref={page > 1 ? signupHref(kind, { page: String(page - 1) }) : undefined} nextHref={entries.length > RESOURCE_PAGE_SIZE ? signupHref(kind, { page: String(page + 1) }) : undefined} />
    </>}
  </div>
}

async function SignupAccessEditor({ params, mode }: { params: Promise<{ kind: string; id?: string }>; mode: 'new' | 'edit' | 'delete' }) {
  await connection()
  const { kind, id } = await params
  if (!isSignupKind(kind) || (mode !== 'new' && !isResourceId(id))) notFound()
  const definition = signupDefinitions[kind]
  let entry: SignupEntry | undefined
  if (mode !== 'new') {
    const supabase = await createClient()
    const { data, error } = await supabase.from(definition.table).select(definition.select).eq('id', id!)
      .maybeSingle().overrideTypes<SignupEntry, { merge: false }>()
    if (error) return <QueryError message={error.message} href={`/admin/signup-access/${kind}/${id}/${mode}`} />
    if (!data) return <AdminNotice title="Entry not found"><Link href={signupHref(kind)} className={linkClass}>Back to {definition.title.toLowerCase()}</Link></AdminNotice>
    entry = data
  }
  return <div className="space-y-6">
    <Link href={signupHref(kind)} className={linkClass}>← Back to {definition.title.toLowerCase()}</Link>
    <AdminPageHeader title={`${mode === 'new' ? 'Add' : mode === 'delete' ? 'Delete' : 'Edit'} ${definition.noun}`} description={mode === 'delete' ? 'Review and confirm removal from this signup list.' : 'Active entries provide an additional way to qualify for CapRate signup and sign-in.'} />
    {entry && <AdminDetails title="Entry details" fields={[
      { label: 'ID', value: entry.id },
      { label: 'Created (UTC)', value: new Date(entry.created_at).toLocaleString('en-US', { timeZone: 'UTC' }) },
      { label: 'Last updated (UTC)', value: new Date(entry.updated_at).toLocaleString('en-US', { timeZone: 'UTC' }) },
    ]} />}
    {mode === 'delete' && entry ? <DeleteSignupAccessForm kind={kind} entry={entry} /> : <SignupAccessForm kind={kind} entry={entry} />}
  </div>
}

export function SignupAccessPage({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <div className="space-y-6"><AdminPageHeader title="Signup access" description="Maintain allowed signup domains and whitelisted email addresses." /><EnforcementNotice /><Suspense fallback={<LoadingSignup />}><SignupAccessList searchParams={searchParams} /></Suspense></div>
}

export function SignupAccessEditorPage({ params, mode }: { params: Promise<{ kind: string; id?: string }>; mode: 'new' | 'edit' | 'delete' }) {
  return <div className="space-y-6"><EnforcementNotice /><Suspense fallback={<LoadingSignup />}><SignupAccessEditor params={params} mode={mode} /></Suspense></div>
}
