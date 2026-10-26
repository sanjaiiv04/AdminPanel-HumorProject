import { validateIdentity } from '@/lib/admin/catalog-validation'

export type ContentKind = 'terms' | 'generation-examples'
export interface Term {
  id: string
  term: string
  definition: string
  example: string | null
  is_active: boolean
  updated_at: string
}
export interface GenerationExample {
  id: string
  caption: string
  context: string | null
  prompt_chain_id: string | null
  image_id: string | null
  sentiment: 'positive' | 'negative'
  is_active: boolean
  updated_at: string
  chain?: { name: string } | null
}

const text = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export function validateTerm(form: FormData) {
  const identity = validateIdentity(form)
  const errors = { ...identity.errors }
  const term = text(form, 'term')
  const definition = text(form, 'definition')
  const example = text(form, 'example')
  if (!term || term.length > 200) errors.term = 'Enter a term of 1–200 characters.'
  if (!definition || definition.length > 10000) errors.definition = 'Enter a definition of 1–10000 characters.'
  if (example.length > 2000) errors.example = 'Use at most 2000 characters for the example.'
  return { ...identity, errors, values: { term, definition, example: example || null, is_active: form.get('is_active') === 'on' } }
}

export function validateGenerationExample(form: FormData) {
  const identity = validateIdentity(form)
  const errors = { ...identity.errors }
  const caption = text(form, 'caption')
  const context = text(form, 'context')
  const chainId = text(form, 'prompt_chain_id')
  const imageId = text(form, 'image_id')
  const sentiment = text(form, 'sentiment')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!caption || caption.length > 2000) errors.caption = 'Enter a caption of 1–2000 characters.'
  if (context.length > 4000) errors.context = 'Use at most 4000 characters for the context.'
  if (chainId && !uuid.test(chainId)) errors.prompt_chain_id = 'Choose a prompt chain or select All chains.'
  if (imageId && !uuid.test(imageId)) errors.image_id = 'Enter a complete image UUID or leave this blank.'
  if (sentiment !== 'positive' && sentiment !== 'negative') errors.sentiment = 'Choose Positive or Negative.'
  return { ...identity, errors, values: {
    caption, context: context || null, prompt_chain_id: chainId || null, image_id: imageId || null,
    sentiment, is_active: form.get('is_active') === 'on',
  } }
}

export function contentMutationError(error: { code?: string }, kind: ContentKind) {
  if (error.code === '23505' && kind === 'terms') return 'This term already exists. Term names are unique regardless of letter case or surrounding spaces.'
  if (error.code === '23503') return 'The linked chain or image changed or was removed. Reload the form and choose an existing record.'
  if (error.code === '42501') return 'Your account does not have permission to make this change.'
  return 'The change could not be saved. Reload the page and try again.'
}
