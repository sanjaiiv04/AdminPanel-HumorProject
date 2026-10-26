import { MediaGalleryPage } from '@/components/admin/media-pages'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <MediaGalleryPage searchParams={searchParams} />
}
