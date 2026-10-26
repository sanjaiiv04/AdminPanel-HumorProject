import { ChainMixPage } from '@/components/admin/catalog-pages'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <ChainMixPage searchParams={searchParams} />
}
