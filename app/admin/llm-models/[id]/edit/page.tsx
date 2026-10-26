import { CatalogEditorPage } from '@/components/admin/catalog-pages'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogEditorPage kind="models" params={params} />
}
