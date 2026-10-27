'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizedAdminClient } from '@/lib/admin/authorize'
import { validateStepSettings } from '@/lib/admin/step-settings'
import type { MutationState } from '@/lib/admin/catalog-validation'

export async function saveStepSettings(_previous: MutationState, form: FormData): Promise<MutationState> {
  let id = ''
  try {
    const client = await authorizedAdminClient()
    const validated = validateStepSettings(form)
    if (Object.keys(validated.errors).length) return { status: 'error', message: 'Please check the fields.', errors: validated.errors }
    id = validated.id
    const { data: modelRow, error: modelError } = await client.from('llm_models')
      .select('id, model_identifier, is_active, supports_images, provider:llm_providers(slug, is_active)')
      .eq('id', validated.values.llm_model_id).maybeSingle()
    const model = modelRow as { id: string; model_identifier: string; is_active: boolean; supports_images: boolean; provider: { slug: string; is_active: boolean } | null } | null
    if (modelError || !model?.is_active || !model.provider?.is_active || model.provider.slug !== 'google' || !/^gemini-[a-zA-Z0-9._-]+$/.test(model.model_identifier)
      || (validated.values.include_image && !model.supports_images)) return { status: 'error', message: 'Choose an active Google model/provider that supports images when Include image is enabled.' }
    const { data, error } = await client.from('prompt_chain_steps').update(validated.values)
      .eq('id', id).eq('updated_at', validated.updatedAt).select('id').maybeSingle()
    if (error) return { status: 'error', message: 'Unable to save step settings. Reload and try again.' }
    if (!data) return { status: 'error', message: 'This step changed or was removed. Reload before saving.' }
  } catch (error) { return { status: 'error', message: error instanceof Error ? error.message : 'Unable to save step.' } }
  revalidatePath('/admin/prompt-chain-steps')
  revalidatePath(`/admin/prompt-chain-steps/${id}`)
  redirect(`/admin/prompt-chain-steps/${id}`)
}
