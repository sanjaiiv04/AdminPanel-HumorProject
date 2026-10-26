import { ResourceDetailPage } from '@/components/admin/read-resource'

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceDetailPage resource="prompt-chain-steps" params={params} />
}
