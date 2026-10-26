export type CatalogKind = 'providers' | 'models'
export interface Provider {
  id: string
  slug: string
  name: string
  is_active: boolean
  updated_at: string
}
export interface Model {
  id: string
  provider_id: string
  name: string
  model_identifier: string
  supports_images: boolean
  is_active: boolean
  updated_at: string
  provider?: { name: string; is_active: boolean } | null
}
export interface MixEntry {
  id: string
  prompt_chain_id: string
  weight: number | string
  is_enabled: boolean
  updated_at: string
  chain: { name: string; is_active: boolean } | null
}
export interface MutationState {
  status: 'idle' | 'error' | 'success'
  message: string
  errors?: Record<string, string>
}
export const initialMutationState: MutationState = { status: 'idle', message: '' }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function validateIdentity(form: FormData, required = false) {
  const id = text(form, 'id')
  const updatedAt = text(form, 'updated_at')
  const errors: Record<string, string> = {}
  if ((required || id) && !uuid.test(id)) errors.id = 'This record has an invalid ID. Reload the page.'
  if (id && (!updatedAt || Number.isNaN(Date.parse(updatedAt)))) errors.updated_at = 'Reload the record before making changes.'
  return { id, updatedAt, errors }
}

export function validateProvider(form: FormData) {
  const identity = validateIdentity(form)
  const errors = { ...identity.errors }
  const name = text(form, 'name')
  const slug = text(form, 'slug')
  if (!name || name.length > 120) errors.name = 'Enter a provider name of 1–120 characters.'
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(slug)) errors.slug = 'Use 1–64 lowercase letters, numbers, hyphens, or underscores; start with a letter.'
  return { ...identity, errors, values: { name, slug, is_active: form.get('is_active') === 'on' } }
}

export function validateModel(form: FormData) {
  const identity = validateIdentity(form)
  const errors = { ...identity.errors }
  const name = text(form, 'name')
  const providerId = text(form, 'provider_id')
  const identifier = text(form, 'model_identifier')
  if (!name || name.length > 120) errors.name = 'Enter a model name of 1–120 characters.'
  if (!uuid.test(providerId)) errors.provider_id = 'Choose a provider.'
  if (!identifier || identifier.length > 200 || /\s/.test(identifier)) errors.model_identifier = 'Enter a model identifier of 1–200 characters without spaces.'
  return { ...identity, errors, values: {
    name, provider_id: providerId, model_identifier: identifier,
    supports_images: form.get('supports_images') === 'on', is_active: form.get('is_active') === 'on',
  } }
}

export function validateMix(form: FormData) {
  const identity = validateIdentity(form, true)
  const errors = { ...identity.errors }
  const weight = text(form, 'weight')
  // Match numeric(12,6) exactly; reject exponents, non-finite values, and rounding.
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(weight) || Number(weight) <= 0) {
    errors.weight = 'Enter a weight greater than 0, up to 999999.999999, with at most 6 decimal places.'
  }
  return { ...identity, errors, values: { weight, is_enabled: form.get('is_enabled') === 'on' } }
}

export function mutationError(error: { code?: string; message?: string }, kind?: CatalogKind): string {
  if (error.code === '23505') return kind === 'providers' ? 'A provider with this slug already exists.' : 'This provider already has a model with that identifier.'
  if (error.code === '23503') return kind === 'providers'
    ? 'This provider is used by models. Reassign or remove those models before deleting it.'
    : 'This model is used by prompt chain steps. Reassign those steps before deleting it.'
  if (error.code === '42501') return 'Your account does not have permission to make this change.'
  return 'The change could not be saved. Reload the page and try again.'
}
