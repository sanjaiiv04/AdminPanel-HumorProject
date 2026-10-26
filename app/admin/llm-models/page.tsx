import { redirect } from 'next/navigation'
import { catalogHref } from '@/lib/admin/catalog-navigation'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default async function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  const params = await searchParams
  const query: Record<string, string> = {}
  for (const key of ['page', 'saved', 'deleted']) {
    const value = params[key]
    if (typeof value === 'string') query[key] = value
  }
  redirect(catalogHref('models', query))
}
