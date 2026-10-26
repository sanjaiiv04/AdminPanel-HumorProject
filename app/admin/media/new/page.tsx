import { MediaEditorPage } from '@/components/admin/media-pages'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <MediaEditorPage searchParams={searchParams} />
}
