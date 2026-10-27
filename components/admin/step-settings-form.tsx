'use client'
import { useActionState, useState } from 'react'
import { saveStepSettings } from '@/app/admin/prompt-chain-steps/actions'
import { initialMutationState } from '@/lib/admin/catalog-validation'
import { stepFlags, type StepSettings } from '@/lib/admin/step-settings'
import { MutationFeedback, RecordIdentity } from './catalog-forms'
const labels = { include_image: 'Include uploaded image', use_community_examples: 'Use community-rated captions', use_curated_examples: 'Use active generation example captions and context', use_terms: 'Use active terms', include_user_context: 'Include user style/context' }
export function StepSettingsForm({ step, models }: { step: StepSettings; models: { id: string; name: string; model_identifier: string }[] }) {
  const [state, action, pending] = useActionState(saveStepSettings, initialMutationState)
  const [prompt, setPrompt] = useState(step.prompt_template)
  const [model, setModel] = useState(step.llm_model_id)
  const [flags, setFlags] = useState(Object.fromEntries(stepFlags.map(flag => [flag, step[flag]])))
  return <form action={action} className="space-y-5 rounded-xl bg-white p-6">
    <RecordIdentity record={step} /><MutationFeedback state={state} />
    <label className="block text-sm font-bold">Model<select name="llm_model_id" value={model} onChange={e => setModel(e.target.value)} className="mt-2 block w-full rounded-lg border-2 p-2">{models.map(item => <option key={item.id} value={item.id}>{item.name} ({item.model_identifier})</option>)}</select></label>
    {state.errors?.llm_model_id && <p role="alert">{state.errors.llm_model_id}</p>}
    <label className="block text-sm font-bold">Prompt<textarea name="prompt_template" value={prompt} onChange={e => setPrompt(e.target.value)} rows={8} maxLength={12000} required className="mt-2 block w-full rounded-lg border-2 p-3" /></label>
    {state.errors?.prompt_template && <p role="alert">{state.errors.prompt_template}</p>}
    {stepFlags.map(flag => <label key={flag} className="flex gap-3 text-sm"><input type="checkbox" name={flag} checked={flags[flag]} onChange={e => setFlags({ ...flags, [flag]: e.target.checked })} />{labels[flag]}</label>)}
    <p className="text-sm">Steps run in position order. Each step receives the previous step’s output; the last output becomes the caption. Changes affect new requests after the updated CapRate app is deployed.</p>
    <button disabled={pending} className="rounded-xl border-2 bg-[var(--color-skip)] px-4 py-2 font-bold disabled:opacity-50">{pending ? 'Saving…' : 'Save step settings'}</button>
  </form>
}
