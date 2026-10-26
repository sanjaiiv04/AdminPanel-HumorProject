import { ResourceListPage } from '@/components/admin/read-resource'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <ResourceListPage resource="prompt-chains" searchParams={searchParams} />
}
