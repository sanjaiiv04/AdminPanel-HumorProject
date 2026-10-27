import { validateIdentity } from '@/lib/admin/catalog-validation'

export const stepFlags = ['include_image', 'use_community_examples', 'use_curated_examples', 'use_terms', 'include_user_context'] as const
export type StepSettings = { id: string; updated_at: string; prompt_template: string; llm_model_id: string } & Record<typeof stepFlags[number], boolean>
export function validateStepSettings(form: FormData) {
  const identity = validateIdentity(form, true)
  const errors = { ...identity.errors }
  const prompt = typeof form.get('prompt_template') === 'string' ? String(form.get('prompt_template')).trim() : ''
  const model = String(form.get('llm_model_id') ?? '')
  if (!prompt || prompt.length > 12000) errors.prompt_template = 'Enter a prompt of 1–12000 characters.'
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(model)) errors.llm_model_id = 'Choose a model.'
  const values = { prompt_template: prompt, llm_model_id: model, ...Object.fromEntries(stepFlags.map(flag => [flag, form.get(flag) === 'on'])) } as Pick<StepSettings, 'prompt_template' | 'llm_model_id' | typeof stepFlags[number]>
  return { ...identity, errors, values }
}
