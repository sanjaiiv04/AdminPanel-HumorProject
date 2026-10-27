import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isResourceId, resourcePage, RESOURCE_PAGE_SIZE, type ResourceSearchParams } from '@/lib/admin/read-resources'
import type { ContentKind, GenerationExample, Term } from '@/lib/admin/content-validation'
import { ContentForm, DeleteContentForm, type ChainOption } from './content-forms'
import { AdminDetails, AdminNotice, AdminPageHeader, AdminPagination, AdminTable, type AdminColumn } from './ui'

const linkClass = 'text-sm font-bold underline underline-offset-2'
const termSelect = 'id, term, definition, example, is_active, updated_at'
const exampleSelect = 'id, caption, context, prompt_chain_id, image_id, sentiment, is_active, updated_at, chain:prompt_chains(name)'
const titleFor = (kind: ContentKind) => kind === 'terms' ? 'Terms' : 'AI generation examples'
const nounFor = (kind: ContentKind) => kind === 'terms' ? 'term' : 'example'

function LoadingContent() {
  return <div role="status" className="rounded-2xl border-2 border-[var(--color-ink)] bg-white p-6 text-sm">Loading content…</div>
}

function ContentError({ message, href }: { message: string; href: string }) {
  return <AdminNotice title="Unable to load content" error><p>{message}</p><a href={href} className={`${linkClass} mt-3 inline-block`}>Try again</a></AdminNotice>
}

async function ContentList({ kind, searchParams }: { kind: ContentKind; searchParams: ResourceSearchParams }) {
  await connection()
  const params = await searchParams
  const page = resourcePage(params.page)
  const offset = (page - 1) * RESOURCE_PAGE_SIZE
  const href = `/admin/${kind}`
  const supabase = await createClient()
  const { data, error } = await supabase.from(kind === 'terms' ? 'terms' : 'ai_generation_examples')
    .select(kind === 'terms' ? termSelect : exampleSelect)
    .order(kind === 'terms' ? 'term' : 'created_at', { ascending: kind === 'terms' }).order('id')
    .range(offset, offset + RESOURCE_PAGE_SIZE).overrideTypes<(Term | GenerationExample)[], { merge: false }>()
  if (error) return <ContentError message={error.message} href={`${href}?page=${page}`} />
  const rows = data ?? []
  const columns: AdminColumn<Term | GenerationExample>[] = [
    { key: 'label', label: kind === 'terms' ? 'Term' : 'Caption', render: row => <Link href={`${href}/${row.id}/edit`} className={`${linkClass} block max-w-sm whitespace-pre-wrap break-words`}><span className="line-clamp-3">{'term' in row ? row.term : row.caption}</span></Link> },
    ...(kind === 'terms' ? [
      { key: 'definition', label: 'Definition', render: (row: Term | GenerationExample) => 'definition' in row ? <p className="line-clamp-3 max-w-md whitespace-pre-wrap break-words">{row.definition}</p> : '—' },
    ] : [
      { key: 'sentiment', label: 'Type', render: (row: Term | GenerationExample) => 'sentiment' in row ? row.sentiment === 'positive' ? 'Positive' : 'Negative' : '—' },
      { key: 'chain', label: 'Prompt chain', render: (row: Term | GenerationExample) => 'prompt_chain_id' in row && row.prompt_chain_id ? <Link className={linkClass} href={`/admin/prompt-chains/${row.prompt_chain_id}`}>{row.chain?.name ?? row.prompt_chain_id}</Link> : 'All chains' },
      { key: 'image', label: 'Image ID', render: (row: Term | GenerationExample) => 'image_id' in row && row.image_id ? <span title={row.image_id} className="font-mono text-xs">{row.image_id.slice(0, 8)}…</span> : 'Text only' },
    ]),
    { key: 'active', label: 'Active', render: row => row.is_active ? 'Yes' : 'No' },
    { key: 'actions', label: 'Actions', render: row => <div className="flex gap-4"><Link className={linkClass} href={`${href}/${row.id}/edit`}>Edit</Link><Link className={`${linkClass} text-rose-700`} href={`${href}/${row.id}/delete`}>Delete</Link></div> },
  ]
  return <div className="space-y-4">
    {params.saved === '1' && <AdminNotice title="Changes saved" />}
    {params.deleted === '1' && <AdminNotice title="Record deleted" />}
    <Link className="inline-block rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold" href={`${href}/new`}>Create {nounFor(kind)}</Link>
    {rows.length ? <AdminTable caption={titleFor(kind)} rows={rows.slice(0, RESOURCE_PAGE_SIZE)} columns={columns} rowKey={row => row.id} /> : (
      <AdminNotice title={page > 1 ? 'No records on this page' : kind === 'terms' ? 'No terms yet' : 'No generation examples yet'}>
        {page > 1 ? <Link className={linkClass} href={href}>Return to the first page</Link> : kind === 'terms' ? 'Create a term to get started.' : 'Create an example to get started.'}
      </AdminNotice>
    )}
    <AdminPagination page={page} previousHref={page > 1 ? `${href}?page=${page - 1}` : undefined} nextHref={rows.length > RESOURCE_PAGE_SIZE ? `${href}?page=${page + 1}` : undefined} />
  </div>
}

async function ContentEditor({ kind, params, deleting }: { kind: ContentKind; params?: Promise<{ id: string }>; deleting?: boolean }) {
  await connection()
  const supabase = await createClient()
  let record: Term | GenerationExample | undefined
  if (params) {
    const { id } = await params
    if (!isResourceId(id)) notFound()
    const { data, error } = await supabase.from(kind === 'terms' ? 'terms' : 'ai_generation_examples')
      .select(kind === 'terms' ? termSelect : exampleSelect).eq('id', id).maybeSingle()
      .overrideTypes<Term | GenerationExample, { merge: false }>()
    if (error) return <ContentError message={error.message} href={`/admin/${kind}/${id}/${deleting ? 'delete' : 'edit'}`} />
    if (!data) return <AdminNotice title="Record not found">This record was removed or is unavailable to your account.</AdminNotice>
    record = data
  }
  if (record && deleting) return <DeleteContentForm kind={kind} record={record} />
  const details = record && <AdminDetails title="Record details" fields={[
    { label: 'ID', value: record.id },
    { label: 'Last updated (UTC)', value: new Date(record.updated_at).toLocaleString('en-US', { timeZone: 'UTC' }) },
  ]} />
  if (kind === 'terms') return <div className="space-y-5">{details}<ContentForm kind="terms" record={record as Term | undefined} /></div>
  const chains: ChainOption[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('prompt_chains').select('id, name, is_active')
      .order('name').order('id').range(offset, offset + 499)
    if (error) return <ContentError message={error.message} href={`/admin/${kind}${record ? `/${record.id}/edit` : '/new'}`} />
    chains.push(...data)
    if (data.length < 500) break
  }
  return <div className="space-y-5">{details}<ContentForm kind="generation-examples" record={record as GenerationExample | undefined} chains={chains} /></div>
}

export function ContentListPage({ kind, searchParams }: { kind: ContentKind; searchParams: ResourceSearchParams }) {
  return <div className="space-y-6">
    <AdminPageHeader title={titleFor(kind)} description={kind === 'terms' ? 'Manage vocabulary, definitions, and example usage for caption prompts.' : 'Curate positive and negative caption examples for all chains or a specific chain.'} />
    <p className="text-sm text-[var(--color-muted)]">The updated CapRate generator uses active content when a chain step enables Terms or Curated examples. Open Chain steps, choose a step, then edit its settings. Example captions and context are included; linked example images remain references. Up to 20 terms and the 10 newest matching examples are used.</p>
    <Suspense fallback={<LoadingContent />}><ContentList kind={kind} searchParams={searchParams} /></Suspense>
  </div>
}

export function ContentEditorPage({ kind, params, deleting = false }: { kind: ContentKind; params?: Promise<{ id: string }>; deleting?: boolean }) {
  return <div className="space-y-6">
    <Link className={linkClass} href={`/admin/${kind}`}>← Back to {kind === 'terms' ? 'terms' : 'generation examples'}</Link>
    <AdminPageHeader title={`${deleting ? 'Delete' : params ? 'Edit' : 'Create'} ${nounFor(kind)}`} description={deleting ? 'Review and confirm this deletion.' : kind === 'terms' ? 'Define a term and optionally show how to use it.' : 'Set the example caption, its type, and optional chain or image.'} />
    <Suspense fallback={<LoadingContent />}><ContentEditor kind={kind} params={params} deleting={deleting} /></Suspense>
  </div>
}
