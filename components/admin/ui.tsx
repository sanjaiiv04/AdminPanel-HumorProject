import Link from 'next/link'
import type { ReactNode } from 'react'

export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return <div><h1 className="font-display text-3xl font-black">{title}</h1><p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{description}</p></div>
}

export function AdminNotice({ title, children, error = false }: { title: string; children?: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-2xl border-[3px] border-[var(--color-ink)] p-6 ${error ? 'bg-rose-50 text-rose-800' : 'bg-white'}`}><p className="font-display font-bold">{title}</p>{children && <div className="mt-2 text-sm">{children}</div>}</div>
}

export interface AdminColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
}

export function AdminTable<T>({ caption, columns, rows, rowKey }: { caption: string; columns: AdminColumn<T>[]; rows: T[]; rowKey: (row: T) => string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border-[3px] border-[var(--color-ink)] bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b-[3px] border-[var(--color-ink)] bg-[var(--color-surface)] font-display text-xs font-extrabold uppercase">
          <tr>{columns.map(column => <th key={column.key} scope="col" className="px-6 py-4">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y-2 divide-[var(--color-ink)] font-medium">
          {rows.map(row => <tr key={rowKey(row)} className="transition-colors hover:bg-amber-50/50">{columns.map(column => <td key={column.key} className="px-6 py-4">{column.render(row)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function AdminPagination({ page, previousHref, nextHref, children }: { page: number; previousHref?: string; nextHref?: string; children?: ReactNode }) {
  const style = 'rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold'
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm font-medium text-[var(--color-muted)]">Page {page}{children && <> · {children}</>}</p>
      <div className="flex gap-2">
        {previousHref ? <Link href={previousHref} className={`${style} bg-white`}>Previous</Link> : <span aria-disabled="true" className={`${style} opacity-40`}>Previous</span>}
        {nextHref ? <Link href={nextHref} className={`${style} bg-[var(--color-skip)]`}>Next</Link> : <span aria-disabled="true" className={`${style} opacity-40`}>Next</span>}
      </div>
    </nav>
  )
}

export function AdminDetails({ title, fields }: { title: string; fields: { label: string; value: ReactNode; wide?: boolean }[] }) {
  return <section className="rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6"><h2 className="font-display text-lg font-bold">{title}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(field => <div key={field.label} className={`min-w-0 ${field.wide ? 'sm:col-span-2' : ''}`}><dt className="text-xs font-bold uppercase text-[var(--color-muted)]">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{field.value ?? '—'}</dd></div>)}</dl></section>
}

// The input should use id, aria-describedby and aria-invalid to associate help and errors.
export function AdminFormField({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-bold">{label}</label>{children}{hint && <p id={`${id}-hint`} className="text-xs text-[var(--color-muted)]">{hint}</p>}{error && <p id={`${id}-error`} role="alert" className="text-xs font-bold text-rose-700">{error}</p>}</div>
}
