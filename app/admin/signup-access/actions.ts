'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizedAdminClient } from '@/lib/admin/authorize'
import { validateIdentity, type MutationState } from '@/lib/admin/catalog-validation'
import { isSignupKind, signupDefinitions, signupHref, signupMutationError, validateSignupEntry, type SignupKind } from '@/lib/admin/signup-access'

const failed = (message: string, errors?: Record<string, string>): MutationState => ({ status: 'error', message, errors })
const stale = () => failed('This entry changed or was removed after you opened it. Reload the page before trying again.')

export async function saveSignupEntry(kind: SignupKind, _previous: MutationState, form: FormData): Promise<MutationState> {
  if (!isSignupKind(kind)) return failed('Unknown signup list.')
  try {
    const supabase = await authorizedAdminClient()
    const validated = validateSignupEntry(kind, form)
    if (Object.keys(validated.errors).length) return failed('Please check the form fields.', validated.errors)
    const table = signupDefinitions[kind].table
    const query = validated.id
      ? supabase.from(table).update(validated.values).eq('id', validated.id).eq('updated_at', validated.updatedAt)
      : supabase.from(table).insert(validated.values)
    const { data, error } = await query.select('id').maybeSingle()
    if (error) return failed(signupMutationError(error, kind))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to save this signup entry.')
  }
  revalidatePath('/admin/signup-access')
  redirect(signupHref(kind, { saved: '1' }))
}

export async function deleteSignupEntry(kind: SignupKind, _previous: MutationState, form: FormData): Promise<MutationState> {
  if (!isSignupKind(kind)) return failed('Unknown signup list.')
  try {
    const supabase = await authorizedAdminClient()
    const identity = validateIdentity(form, true)
    if (Object.keys(identity.errors).length) return failed('Reload this entry before deleting it.', identity.errors)
    if (form.get('confirm_delete') !== 'on') return failed('Confirm the deletion before continuing.')
    const { data, error } = await supabase.from(signupDefinitions[kind].table).delete()
      .eq('id', identity.id).eq('updated_at', identity.updatedAt).select('id').maybeSingle()
    if (error) return failed(signupMutationError(error, kind))
    if (!data) return stale()
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Unable to delete this signup entry.')
  }
  revalidatePath('/admin/signup-access')
  redirect(signupHref(kind, { deleted: '1' }))
}
