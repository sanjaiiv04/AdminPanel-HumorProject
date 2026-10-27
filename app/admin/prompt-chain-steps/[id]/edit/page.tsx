import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { authorizedAdminClient } from '@/lib/admin/authorize'
import { isResourceId } from '@/lib/admin/read-resources'
import type { StepSettings } from '@/lib/admin/step-settings'
import { StepSettingsForm } from '@/components/admin/step-settings-form'
import { AdminNotice, AdminPageHeader } from '@/components/admin/ui'
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  if (!isResourceId(id)) notFound()
  const client = await authorizedAdminClient()
  const [{ data: step, error }, { data: models, error: modelError }] = await Promise.all([
    client.from('prompt_chain_steps').select('id, updated_at, prompt_template, llm_model_id, include_image, use_community_examples, use_curated_examples, use_terms, include_user_context').eq('id', id).maybeSingle().overrideTypes<StepSettings, { merge: false }>(),
    client.from('llm_models').select('id, name, model_identifier').order('name').limit(500),
  ])
  if (error || modelError) return <AdminNotice title="Unable to load step settings" error>Reload and try again.</AdminNotice>
  if (!step) notFound()
  return <div className="space-y-5"><Link href={`/admin/prompt-chain-steps/${id}`} className="underline">← Back to step</Link><StepSettingsForm step={step} models={models ?? []} /></div>
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <div className="space-y-6"><AdminPageHeader title="Edit step settings" description="Control the prompt, model, and optional context used by this step." /><Suspense fallback={<p>Loading step…</p>}><Editor params={params} /></Suspense></div>
}
