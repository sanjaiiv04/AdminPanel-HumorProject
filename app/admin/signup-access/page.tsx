import { SignupAccessPage } from '@/components/admin/signup-access-pages'
import type { ResourceSearchParams } from '@/lib/admin/read-resources'

export default function Page({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <SignupAccessPage searchParams={searchParams} />
}
