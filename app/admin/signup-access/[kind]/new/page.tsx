import { SignupAccessEditorPage } from '@/components/admin/signup-access-pages'

export default function Page({ params }: { params: Promise<{ kind: string }> }) {
  return <SignupAccessEditorPage params={params} mode="new" />
}
