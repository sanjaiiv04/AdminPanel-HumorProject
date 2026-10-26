import { MediaEditorPage } from '@/components/admin/media-pages'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MediaEditorPage params={params} imageMode deleting />
}
