import { ContentListPage } from '@/components/admin/content-pages'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <ContentListPage kind="generation-examples" searchParams={searchParams} />
}
