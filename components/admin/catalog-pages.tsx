import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { isResourceId, resourcePage, RESOURCE_PAGE_SIZE, type ResourceSearchParams } from '@/lib/admin/read-resources'
import type { CatalogKind, MixEntry, Model, Provider } from '@/lib/admin/catalog-validation'
import { catalogHref } from '@/lib/admin/catalog-navigation'
import { CatalogForm, ChainMixForm, DeleteCatalogForm } from './catalog-forms'
import { AdminDetails, AdminNotice, AdminPageHeader, AdminPagination, AdminTable, type AdminColumn } from './ui'

const linkClass = 'text-sm font-bold underline underline-offset-2'
const buttonClass = 'inline-block rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold'
const providerSelect = 'id, slug, name, is_active, updated_at'
const modelSelect = 'id, provider_id, name, model_identifier, supports_images, is_active, updated_at, provider:llm_providers(name, is_active)'

function LoadingCatalog() {
  return <div role="status" className="rounded-2xl border-2 border-[var(--color-ink)] bg-white p-6 text-sm">Loading configuration…</div>
}

function QueryError({ message, href }: { message: string; href: string }) {
  return <AdminNotice title="Unable to load configuration" error><p>{message}</p><a href={href} className={`${linkClass} mt-3 inline-block`}>Try again</a></AdminNotice>
}

function CatalogActions({ kind, id }: { kind: CatalogKind; id: string }) {
  return <div className="flex gap-4">
    <Link className={linkClass} href={`/admin/llm-${kind}/${id}/edit`}>Edit<span className="sr-only"> {kind === 'providers' ? 'provider' : 'model'}</span></Link>
    <Link className={`${linkClass} text-rose-700`} href={`/admin/llm-${kind}/${id}/delete`}>Delete<span className="sr-only"> {kind === 'providers' ? 'provider' : 'model'}</span></Link>
  </div>
}

function PageNotice({ saved, deleted }: { saved?: string | string[]; deleted?: string | string[] }) {
  if (saved === '1') return <AdminNotice title="Changes saved" />
  if (deleted === '1') return <AdminNotice title="Record deleted" />
  return null
}

async function CatalogList({ kind, searchParams }: { kind: CatalogKind; searchParams: ResourceSearchParams }) {
  await connection()
  const params = await searchParams
  const page = resourcePage(params.page)
  const offset = (page - 1) * RESOURCE_PAGE_SIZE
  const supabase = await createClient()
  const baseHref = `/admin/llm-${kind}`
  const { data, error } = await supabase.from(kind === 'providers' ? 'llm_providers' : 'llm_models')
    .select(kind === 'providers' ? providerSelect : modelSelect)
    .order('name').order('id').range(offset, offset + RESOURCE_PAGE_SIZE)
    .overrideTypes<(Provider | Model)[], { merge: false }>()
  if (error) return <QueryError message={error.message} href={catalogHref(kind, { page: String(page) })} />
  const records = data ?? []
  const columns: AdminColumn<Provider | Model>[] = [
    { key: 'name', label: 'Name', render: row => <Link className={linkClass} href={`${baseHref}/${row.id}/edit`}>{row.name}</Link> },
    ...(kind === 'providers' ? [
      { key: 'slug', label: 'Slug', render: (row: Provider | Model) => 'slug' in row ? <span className="font-mono text-xs">{row.slug}</span> : '—' },
    ] : [
      { key: 'provider', label: 'Provider', render: (row: Provider | Model) => 'provider_id' in row ? <Link href={`/admin/llm-providers/${row.provider_id}/edit`} className={linkClass}>{row.provider?.name ?? 'Unavailable provider'}{row.provider?.is_active === false ? ' (inactive)' : ''}</Link> : '—' },
      { key: 'identifier', label: 'Model identifier', render: (row: Provider | Model) => 'model_identifier' in row ? <span className="break-all font-mono text-xs">{row.model_identifier}</span> : '—' },
      { key: 'images', label: 'Images', render: (row: Provider | Model) => 'supports_images' in row && row.supports_images ? 'Yes' : 'No' },
    ]),
    { key: 'active', label: 'Active', render: row => row.is_active ? 'Yes' : 'No' },
    { key: 'actions', label: 'Actions', render: row => <CatalogActions kind={kind} id={row.id} /> },
  ]
  return <div className="space-y-4">
    <PageNotice saved={params.saved} deleted={params.deleted} />
    <Link href={`${baseHref}/new`} className={buttonClass}>Create {kind === 'providers' ? 'provider' : 'model'}</Link>
    {records.length ? <AdminTable caption={`LLM ${kind}`} columns={columns} rows={records.slice(0, RESOURCE_PAGE_SIZE)} rowKey={row => row.id} /> : (
      <AdminNotice title={page > 1 ? 'No records on this page' : `No ${kind} yet`}>
        {page > 1 ? <Link href={catalogHref(kind)} className={linkClass}>Return to the first page</Link> : `Create a ${kind === 'providers' ? 'provider' : 'model'} to get started.`}
      </AdminNotice>
    )}
    <AdminPagination page={page} previousHref={page > 1 ? catalogHref(kind, { page: String(page - 1) }) : undefined} nextHref={records.length > RESOURCE_PAGE_SIZE ? catalogHref(kind, { page: String(page + 1) }) : undefined} />
  </div>
}

async function ProviderOptions() {
  const supabase = await createClient()
  const providers: Pick<Provider, 'id' | 'name' | 'is_active'>[] = []
  // Fetch every page so the dropdown does not silently omit providers at the API limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('llm_providers').select('id, name, is_active')
      .order('name').order('id').range(offset, offset + 499)
    if (error) return { providers, error }
    providers.push(...data)
    if (data.length < 500) return { providers, error: null }
  }
}

async function CatalogEditor({ kind, params, deleting = false }: { kind: CatalogKind; params?: Promise<{ id: string }>; deleting?: boolean }) {
  await connection()
  const supabase = await createClient()
  let record: Provider | Model | undefined
  if (params) {
    const { id } = await params
    if (!isResourceId(id)) notFound()
    const { data, error } = await supabase.from(kind === 'providers' ? 'llm_providers' : 'llm_models')
      .select(kind === 'providers' ? providerSelect : modelSelect).eq('id', id).maybeSingle()
      .overrideTypes<Provider | Model, { merge: false }>()
    if (error) return <QueryError message={error.message} href={`/admin/llm-${kind}/${id}/${deleting ? 'delete' : 'edit'}`} />
    if (!data) return <AdminNotice title="Record not found">This record was removed or is not available to your account.</AdminNotice>
    record = data
  }
  if (deleting && record) return <DeleteCatalogForm kind={kind} record={record} />
  const identity = record && <AdminDetails title="Record details" fields={[
    { label: 'ID', value: record.id },
    { label: 'Last updated (UTC)', value: new Date(record.updated_at).toLocaleString('en-US', { timeZone: 'UTC' }) },
  ]} />
  if (kind === 'providers') return <div className="space-y-5">{identity}<CatalogForm kind="providers" record={record as Provider | undefined} /></div>
  const { providers, error } = await ProviderOptions()
  if (error) return <QueryError message={error.message} href={`/admin/llm-models${record ? `/${record.id}/edit` : '/new'}`} />
  if (!providers.length) return <AdminNotice title="Create a provider first"><Link className={linkClass} href="/admin/llm-providers/new">Create provider</Link></AdminNotice>
  return <div className="space-y-5">{identity}<CatalogForm kind="models" record={record as Model | undefined} providers={providers} /></div>
}

export function CatalogListPage({ kind, searchParams }: { kind: CatalogKind; searchParams: ResourceSearchParams }) {
  return <div className="space-y-6">
    <AdminPageHeader title={`LLM ${kind}`} description={`Manage ${kind === 'providers' ? 'provider names, identifiers, and availability' : 'model identifiers, providers, and image support'}. These settings will control generation once configuration-based execution is connected.`} />
    <Suspense fallback={<LoadingCatalog />}><CatalogList kind={kind} searchParams={searchParams} /></Suspense>
  </div>
}

async function CombinedCatalog({ searchParams }: { searchParams: ResourceSearchParams }) {
  const params = await searchParams
  const kind: CatalogKind = params.tab === 'providers' ? 'providers' : 'models'
  return <div className="space-y-5">
    <nav aria-label="Models and providers" className="flex gap-3">
      {(['models', 'providers'] as const).map(tab => <Link key={tab} href={catalogHref(tab)} aria-current={kind === tab ? 'page' : undefined} className={`rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold ${kind === tab ? 'bg-[var(--color-skip)]' : 'bg-white'}`}>{tab === 'models' ? 'Models' : 'Providers'}</Link>)}
    </nav>
    <CatalogList key={kind} kind={kind} searchParams={Promise.resolve(params)} />
  </div>
}

export function ModelsProvidersPage({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <div className="space-y-6">
    <AdminPageHeader title="Models & providers" description="Manage model settings and their providers in one place. Generation still uses its current model until configuration-based execution is connected." />
    <Suspense fallback={<LoadingCatalog />}><CombinedCatalog searchParams={searchParams} /></Suspense>
  </div>
}

export function CatalogEditorPage({ kind, params, deleting = false }: { kind: CatalogKind; params?: Promise<{ id: string }>; deleting?: boolean }) {
  const noun = kind === 'providers' ? 'provider' : 'model'
  return <div className="space-y-6">
    <Link className={linkClass} href={catalogHref(kind)}>← Back to {kind}</Link>
    <AdminPageHeader title={`${deleting ? 'Delete' : params ? 'Edit' : 'Create'} ${noun}`} description={deleting ? 'Review and confirm this deletion.' : `Set the ${noun} details and availability.`} />
    <Suspense fallback={<LoadingCatalog />}><CatalogEditor kind={kind} params={params} deleting={deleting} /></Suspense>
  </div>
}

async function ChainMixList({ searchParams }: { searchParams: ResourceSearchParams }) {
  await connection()
  const params = await searchParams
  const page = resourcePage(params.page)
  const offset = (page - 1) * RESOURCE_PAGE_SIZE
  const supabase = await createClient()
  const { data, error } = await supabase.from('prompt_chain_mix')
    .select('id, prompt_chain_id, weight, is_enabled, updated_at, chain:prompt_chains(name, is_active)')
    .order('created_at').order('id').range(offset, offset + RESOURCE_PAGE_SIZE)
    .overrideTypes<MixEntry[], { merge: false }>()
  if (error) return <QueryError message={error.message} href={`/admin/prompt-chain-mix?page=${page}`} />
  const entries = data ?? []
  return <div className="space-y-4">
    <PageNotice saved={params.saved} />
    {entries.length ? <AdminTable caption="Prompt chain mix" rows={entries.slice(0, RESOURCE_PAGE_SIZE)} rowKey={entry => entry.id} columns={[
      { key: 'chain', label: 'Prompt chain', render: entry => <Link className={linkClass} href={`/admin/prompt-chains/${entry.prompt_chain_id}`}>{entry.chain?.name ?? entry.prompt_chain_id}</Link> },
      { key: 'active', label: 'Chain status', render: entry => entry.chain?.is_active ? 'Active' : 'Inactive — not eligible for selection' },
      { key: 'settings', label: 'Mix settings', render: entry => <ChainMixForm key={`${entry.id}-${entry.updated_at}`} entry={entry} /> },
    ]} /> : <AdminNotice title="No mix entries on this page"><Link href="/admin/prompt-chains" className={linkClass}>View prompt chains</Link></AdminNotice>}
    <AdminPagination page={page} previousHref={page > 1 ? `/admin/prompt-chain-mix?page=${page - 1}` : undefined} nextHref={entries.length > RESOURCE_PAGE_SIZE ? `/admin/prompt-chain-mix?page=${page + 1}` : undefined} />
  </div>
}

export function ChainMixPage({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <div className="space-y-6">
    <AdminPageHeader title="Prompt chain mix" description="Set relative weights and enable or disable chains. Among eligible chains, weight 2 is selected twice as often as weight 1. Weights do not need to add up to 100." />
    <p className="text-sm text-[var(--color-muted)]">These settings will take effect after configuration-based execution is connected. Enabled chains must also have active models and providers.</p>
    <Suspense fallback={<LoadingCatalog />}><ChainMixList searchParams={searchParams} /></Suspense>
  </div>
}
