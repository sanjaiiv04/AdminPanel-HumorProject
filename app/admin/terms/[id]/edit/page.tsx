import { ContentEditorPage } from '@/components/admin/content-pages'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ContentEditorPage kind="terms" params={params} />
}
