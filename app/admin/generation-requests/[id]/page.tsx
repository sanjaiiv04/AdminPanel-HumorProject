import { ResourceDetailPage } from '@/components/admin/read-resource'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceDetailPage resource="generation-requests" params={params} />
}
