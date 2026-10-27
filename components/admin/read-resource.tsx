import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  isResourceId, readResources, resourcePage, resourceValue, RESOURCE_PAGE_SIZE,
  type ResourceField, type ResourceKey, type ResourceRecord, type ResourceSearchParams,
} from '@/lib/admin/read-resources'
import { AdminDetails, AdminNotice, AdminPageHeader, AdminPagination, AdminTable } from './ui'

const linkClass = 'font-bold underline underline-offset-2 hover:text-[var(--color-muted)]'

function ResourceSkeleton() {
  return <div role="status" className="space-y-4 motion-safe:animate-pulse">
    <span className="sr-only">Loading records…</span>
    <div className="h-12 rounded-xl bg-gray-200" />
    <div className="h-64 rounded-xl bg-gray-100" />
  </div>
}

function ResourceFieldValue({ row, field, compact = false }: { row: ResourceRecord; field: ResourceField; compact?: boolean }) {
  const value = resourceValue(row, field.key)
  const linkedId = field.link && resourceValue(row, field.link.idKey)
  let content: ReactNode = '—'

  if (value !== null && value !== undefined && value !== '') {
    if (field.format === 'date' && typeof value === 'string') {
      const date = new Date(value)
      content = Number.isNaN(date.getTime()) ? '—' : <time dateTime={date.toISOString()} className="whitespace-nowrap">{date.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })}</time>
    } else if (field.format === 'boolean') {
      content = value ? 'Yes' : 'No'
    } else if (field.format === 'status' && typeof value === 'string') {
      const color = value === 'failed' ? 'bg-rose-100 text-rose-800' : value === 'succeeded' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
      content = <span className={`inline-block rounded-full border border-current px-2 py-1 text-xs font-bold ${color}`}>{value}</span>
    } else if (field.format === 'json') {
      content = <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface)] p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    } else if (typeof value === 'string' || typeof value === 'number') {
      content = field.format === 'code'
        ? <span title={String(value)} className="break-all font-mono text-xs">{compact && isResourceId(value) ? `${value.slice(0, 8)}…` : value}</span>
        : <span className="break-words">{value}</span>
    }
  }

  // Keep foreign-key navigation useful even if a related label is unavailable.
  if (field.link && isResourceId(linkedId)) {
    return <Link href={`/admin/${field.link.resource}/${linkedId}`} className={linkClass}>{value == null ? linkedId : content}</Link>
  }
  return <>{content}</>
}

function ResourceError({ href, message }: { href: string; message: string }) {
  return <AdminNotice title="Unable to load records" error>
    <p>{message}</p>
    {/* A full request also retries when the current URL is unchanged. */}
    <a href={href} className={`${linkClass} mt-3 inline-block`}>Try again</a>
  </AdminNotice>
}

async function ResourceList({ resource, searchParams }: { resource: ResourceKey; searchParams: ResourceSearchParams }) {
  await connection()
  const definition = readResources[resource]
  const params = await searchParams
  const page = resourcePage(params.page)
  const filterValue = definition.filter ? params[definition.filter.parameter] : undefined
  const baseHref = `/admin/${resource}`

  if (filterValue !== undefined && filterValue !== '' && !isResourceId(filterValue)) {
    return <AdminNotice title={`Invalid ${definition.filter?.label.toLowerCase()}`} error>
      <p>Use a complete UUID to filter these records.</p>
      <Link href={baseHref} className={`${linkClass} mt-3 inline-block`}>Clear filter</Link>
    </AdminNotice>
  }

  const activeFilter = isResourceId(filterValue) ? filterValue : undefined
  const hrefForPage = (target: number) => {
    const query = new URLSearchParams({ page: String(target) })
    if (definition.filter && activeFilter) query.set(definition.filter.parameter, activeFilter)
    return `${baseHref}?${query}`
  }
  const offset = (page - 1) * RESOURCE_PAGE_SIZE
  const supabase = await createClient()
  let query = supabase.from(definition.table).select(definition.listSelect)
  if (definition.filter && activeFilter) query = query.eq(definition.filter.column, activeFilter)
  // Within one request, show calls in execution order rather than latest first.
  const order = resource === 'llm-responses' && activeFilter
    ? [{ column: 'step_position', ascending: true }, { column: 'attempt', ascending: true }, { column: 'id', ascending: true }]
    : definition.order
  for (const item of order) query = query.order(item.column, { ascending: item.ascending })
  const { data, error } = await query.range(offset, offset + RESOURCE_PAGE_SIZE)
    .overrideTypes<ResourceRecord[], { merge: false }>()

  if (error) return <ResourceError href={hrefForPage(page)} message={error.message} />
  const records = data ?? []
  const visible = records.slice(0, RESOURCE_PAGE_SIZE)
  const columns = definition.columns.map((field, index) => ({
    key: field.key, label: field.label,
    render: (row: ResourceRecord) => index === 0
      ? <Link href={`${baseHref}/${row.id}`} className={linkClass}><ResourceFieldValue row={row} field={field} compact /><span className="sr-only"> — view {definition.singular.toLowerCase()} details</span></Link>
      : <ResourceFieldValue row={row} field={field} compact />,
  }))

  return <div className="space-y-4">
    {definition.filter && <form method="get" action={baseHref} className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-[var(--color-ink)] bg-white p-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="resource-filter" className="mb-1 block text-xs font-bold uppercase">{definition.filter.label}</label>
        <input id="resource-filter" name={definition.filter.parameter} type="text" defaultValue={activeFilter ?? ''} placeholder="Enter a complete UUID" className="w-full rounded-lg border-2 border-[var(--color-ink)] px-3 py-2 text-sm" />
      </div>
      <button type="submit" className="rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold">Filter</button>
      {activeFilter && <Link href={baseHref} className={`${linkClass} py-2 text-sm`}>Clear</Link>}
    </form>}
    {definition.filter && activeFilter && <p className="text-sm"><Link href={`/admin/${definition.filter.resource}/${activeFilter}`} className={linkClass}>View parent {definition.filter.label.toLowerCase().replace(' id', '')}</Link></p>}
    {visible.length ? <AdminTable caption={definition.title} columns={columns} rows={visible} rowKey={row => row.id} /> : (
      <AdminNotice title={page > 1 ? 'No records on this page' : activeFilter ? 'No matching records' : `No ${definition.title.toLowerCase()} yet`}>
        <p>{activeFilter ? 'No records were returned for this filter.' : definition.emptyDescription}</p>
        {page > 1 && <Link href={hrefForPage(1)} className={`${linkClass} mt-3 inline-block`}>Return to the first page</Link>}
      </AdminNotice>
    )}
    <AdminPagination page={page} previousHref={page > 1 ? hrefForPage(page - 1) : undefined} nextHref={records.length > RESOURCE_PAGE_SIZE ? hrefForPage(page + 1) : undefined}>
      {visible.length ? `Showing ${offset + 1}–${offset + visible.length}` : '0 records shown'}
    </AdminPagination>
  </div>
}

async function ResourceDetail({ resource, params }: { resource: ResourceKey; params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  if (!isResourceId(id)) notFound()
  const definition = readResources[resource]
  const supabase = await createClient()
  const { data: row, error } = await supabase.from(definition.table)
    .select(definition.detailSelect).eq('id', id).maybeSingle()
    .overrideTypes<ResourceRecord, { merge: false }>()

  if (error) return <ResourceError href={`/admin/${resource}/${id}`} message={error.message} />
  if (!row) return <AdminNotice title={`${definition.singular} not found`}>This record may have been removed or is unavailable to your account.</AdminNotice>

  return <div className="space-y-6">
    <AdminDetails title={typeof row.name === 'string' ? row.name : definition.singular} fields={definition.details.map(field => ({
      label: field.label, wide: field.wide, value: <ResourceFieldValue row={row} field={field} />,
    }))} />
    {resource === 'prompt-chain-steps' && <Link href={`/admin/prompt-chain-steps/${id}/edit`} className="inline-block rounded-xl border-2 bg-[var(--color-skip)] px-4 py-3 text-sm font-bold">Edit prompt and step settings</Link>}
    {definition.children && <Link href={`/admin/${definition.children.resource}?${new URLSearchParams({ [definition.children.parameter]: id })}`} className="inline-block rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-3 text-sm font-bold">{definition.children.label}</Link>}
  </div>
}

export function ResourceListPage({ resource, searchParams }: { resource: ResourceKey; searchParams: ResourceSearchParams }) {
  const definition = readResources[resource]
  return <div className="space-y-6">
    <AdminPageHeader title={definition.title} description={definition.description} />
    <Suspense fallback={<ResourceSkeleton />}><ResourceList resource={resource} searchParams={searchParams} /></Suspense>
  </div>
}

export function ResourceDetailPage({ resource, params }: { resource: ResourceKey; params: Promise<{ id: string }> }) {
  const definition = readResources[resource]
  return <div className="space-y-6">
    <Link href={`/admin/${resource}`} className={`${linkClass} inline-block text-sm`}>← Back to {definition.title.toLowerCase()}</Link>
    <AdminPageHeader title={definition.singular} description="Read-only record details." />
    <Suspense fallback={<ResourceSkeleton />}><ResourceDetail resource={resource} params={params} /></Suspense>
  </div>
}
