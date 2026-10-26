'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizedAdminClient } from '@/lib/admin/authorize'
import { catalogHref } from '@/lib/admin/catalog-navigation'
import {
  mutationError, validateIdentity, validateMix, validateModel, validateProvider,
  type CatalogKind, type MutationState,
} from '@/lib/admin/catalog-validation'

const invalid = (errors: Record<string, string>): MutationState => ({ status: 'error', message: 'Please check the form fields.', errors })
const failed = (message: string): MutationState => ({ status: 'error', message })
const stale = () => failed('This record changed or was removed after you opened it. Reload the page before trying again.')

// Every mutation authorizes independently; the proxy and browser UI are not trusted.
async function saveCatalog(kind: CatalogKind, form: FormData): Promise<MutationState> {
  let supabase: Awaited<ReturnType<typeof authorizedAdminClient>>
  try { supabase = await authorizedAdminClient() } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to verify your admin session.')
  }
  const validated = kind === 'providers' ? validateProvider(form) : validateModel(form)
  if (Object.keys(validated.errors).length) return invalid(validated.errors)
  const table = kind === 'providers' ? 'llm_providers' : 'llm_models'
  try {
    if (kind === 'models') {
      const providerId = 'provider_id' in validated.values ? validated.values.provider_id : ''
      const { data: provider, error } = await supabase.from('llm_providers').select('id').eq('id', providerId).maybeSingle()
      if (error) return failed(mutationError(error, kind))
      if (!provider) return invalid({ provider_id: 'This provider is no longer available. Reload the page.' })
    }
    const values: Record<string, string | boolean> = validated.values
    const query = validated.id
      ? supabase.from(table).update(values).eq('id', validated.id).eq('updated_at', validated.updatedAt)
      : supabase.from(table).insert(values)
    const { data, error } = await query.select('id').maybeSingle()
    if (error) return failed(mutationError(error, kind))
    if (!data) return stale()
  } catch {
    return failed('Unable to reach the database. Please try again.')
  }
  revalidatePath('/admin', 'layout')
  redirect(catalogHref(kind, { saved: '1' }))
}

export async function saveProvider(_previous: MutationState, form: FormData): Promise<MutationState> {
  return saveCatalog('providers', form)
}

export async function saveModel(_previous: MutationState, form: FormData): Promise<MutationState> {
  return saveCatalog('models', form)
}

export async function deleteCatalogRecord(kind: CatalogKind, _previous: MutationState, form: FormData): Promise<MutationState> {
  // Bind parameters can still be forged by direct requests.
  if (kind !== 'providers' && kind !== 'models') return failed('Unknown record type.')
  try {
    const supabase = await authorizedAdminClient()
    const identity = validateIdentity(form, true)
    if (Object.keys(identity.errors).length) return invalid(identity.errors)
    if (form.get('confirm_delete') !== 'on') return failed('Confirm the deletion before continuing.')
    const { data, error } = await supabase.from(kind === 'providers' ? 'llm_providers' : 'llm_models')
      .delete().eq('id', identity.id).eq('updated_at', identity.updatedAt).select('id').maybeSingle()
    if (error) return failed(mutationError(error, kind))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to delete this record.')
  }
  revalidatePath('/admin', 'layout')
  redirect(catalogHref(kind, { deleted: '1' }))
}

export async function updateChainMix(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const supabase = await authorizedAdminClient()
    const validated = validateMix(form)
    if (Object.keys(validated.errors).length) return invalid(validated.errors)
    const { data, error } = await supabase.from('prompt_chain_mix').update(validated.values)
      .eq('id', validated.id).eq('updated_at', validated.updatedAt).select('id').maybeSingle()
    if (error) return failed(mutationError(error))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to update this mix entry.')
  }
  revalidatePath('/admin/prompt-chain-mix')
  redirect('/admin/prompt-chain-mix?saved=1')
}
