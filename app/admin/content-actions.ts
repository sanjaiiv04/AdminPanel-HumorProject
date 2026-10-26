'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizedAdminClient } from '@/lib/admin/authorize'
import { validateIdentity, type MutationState } from '@/lib/admin/catalog-validation'
import { contentMutationError, validateGenerationExample, validateTerm, type ContentKind } from '@/lib/admin/content-validation'

const failed = (message: string, errors?: Record<string, string>): MutationState => ({ status: 'error', message, errors })
const stale = () => failed('This record changed or was removed after you opened it. Reload the page before trying again.')

async function saveContent(kind: ContentKind, form: FormData): Promise<MutationState> {
  try {
    const supabase = await authorizedAdminClient()
    const validated = kind === 'terms' ? validateTerm(form) : validateGenerationExample(form)
    if (Object.keys(validated.errors).length) return failed('Please check the form fields.', validated.errors)
    if (kind === 'generation-examples' && 'prompt_chain_id' in validated.values) {
      const references = [
        { table: 'prompt_chains', field: 'prompt_chain_id', id: validated.values.prompt_chain_id },
        { table: 'images', field: 'image_id', id: validated.values.image_id },
      ]
      for (const reference of references) {
        if (!reference.id) continue
        const { data, error } = await supabase.from(reference.table).select('id').eq('id', reference.id).maybeSingle()
        if (error) return failed(contentMutationError(error, kind))
        if (!data) return failed('Please check the linked records.', { [reference.field]: `This ${reference.field === 'image_id' ? 'image' : 'chain'} is no longer available. Reload the page.` })
      }
    }
    const table = kind === 'terms' ? 'terms' : 'ai_generation_examples'
    const values: Record<string, string | boolean | null> = validated.values
    const query = validated.id
      ? supabase.from(table).update(values).eq('id', validated.id).eq('updated_at', validated.updatedAt)
      : supabase.from(table).insert(values)
    const { data, error } = await query.select('id').maybeSingle()
    if (error) return failed(contentMutationError(error, kind))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to save this record.')
  }
  revalidatePath(`/admin/${kind}`)
  redirect(`/admin/${kind}?saved=1`)
}

export async function saveTerm(_previous: MutationState, form: FormData): Promise<MutationState> {
  return saveContent('terms', form)
}

export async function saveGenerationExample(_previous: MutationState, form: FormData): Promise<MutationState> {
  return saveContent('generation-examples', form)
}

export async function deleteContentRecord(kind: ContentKind, _previous: MutationState, form: FormData): Promise<MutationState> {
  if (kind !== 'terms' && kind !== 'generation-examples') return failed('Unknown record type.')
  try {
    const supabase = await authorizedAdminClient()
    const identity = validateIdentity(form, true)
    if (Object.keys(identity.errors).length) return failed('Reload this record before deleting it.', identity.errors)
    if (form.get('confirm_delete') !== 'on') return failed('Confirm the deletion before continuing.')
    const { data, error } = await supabase.from(kind === 'terms' ? 'terms' : 'ai_generation_examples')
      .delete().eq('id', identity.id).eq('updated_at', identity.updatedAt).select('id').maybeSingle()
    if (error) return failed(contentMutationError(error, kind))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to delete this record.')
  }
  revalidatePath(`/admin/${kind}`)
  redirect(`/admin/${kind}?deleted=1`)
}
