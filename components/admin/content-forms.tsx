'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { deleteContentRecord, saveGenerationExample, saveTerm } from '@/app/admin/content-actions'
import { initialMutationState } from '@/lib/admin/catalog-validation'
import type { ContentKind, GenerationExample, Term } from '@/lib/admin/content-validation'
import { MutationFeedback, RecordIdentity } from './catalog-forms'
import { AdminFormField } from './ui'

const inputClass = 'w-full rounded-lg border-2 border-[var(--color-ink)] bg-white px-3 py-2 text-sm'
const buttonClass = 'rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold disabled:opacity-50'
export type ChainOption = { id: string; name: string; is_active: boolean }
type ContentFormProps =
  | { kind: 'terms'; record?: Term }
  | { kind: 'generation-examples'; record?: GenerationExample; chains: ChainOption[] }

export function ContentForm(props: ContentFormProps) {
  const { kind, record } = props
  const term = record && 'term' in record ? record : undefined
  const example = record && 'caption' in record ? record : undefined
  const [state, formAction, pending] = useActionState(kind === 'terms' ? saveTerm : saveGenerationExample, initialMutationState)
  const [values, setValues] = useState<Record<string, string>>({
    term: term?.term ?? '', definition: term?.definition ?? '', example: term?.example ?? '',
    caption: example?.caption ?? '', context: example?.context ?? '',
    prompt_chain_id: example?.prompt_chain_id ?? '', image_id: example?.image_id ?? '', sentiment: example?.sentiment ?? 'positive',
  })
  const [active, setActive] = useState(record?.is_active ?? true)
  const setValue = (key: string, value: string) => setValues(previous => ({ ...previous, [key]: value }))
  const field = (key: string, label: string, maxLength: number, multiline = false, required = false, hint?: string) => {
    const attributes = {
      id: key, name: key, value: values[key], maxLength, required,
      'aria-invalid': !!state.errors?.[key],
      'aria-describedby': [hint ? `${key}-hint` : '', state.errors?.[key] ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined,
      className: inputClass,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(key, event.target.value),
    }
    return <AdminFormField id={key} label={label} hint={hint} error={state.errors?.[key]}>
      {multiline ? <textarea {...attributes} rows={key === 'definition' ? 6 : 4} /> : <input {...attributes} />}
    </AdminFormField>
  }

  return <form action={formAction} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={record} />
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      {kind === 'terms' ? <>
        {field('term', 'Term', 200, false, true)}
        {field('definition', 'Definition', 10000, true, true)}
        {field('example', 'Example usage (optional)', 2000, true)}
      </> : <>
        {field('caption', 'Example caption', 2000, true, true)}
        {field('context', 'Context (optional)', 4000, true)}
        <AdminFormField id="sentiment" label="Example type" hint="Positive examples show a style to follow; negative examples show a style to avoid." error={state.errors?.sentiment}>
          <select id="sentiment" name="sentiment" value={values.sentiment} onChange={event => setValue('sentiment', event.target.value)} required aria-invalid={!!state.errors?.sentiment} aria-describedby={`sentiment-hint${state.errors?.sentiment ? ' sentiment-error' : ''}`} className={inputClass}>
            <option value="positive">Positive — style to follow</option>
            <option value="negative">Negative — style to avoid</option>
          </select>
        </AdminFormField>
        <AdminFormField id="prompt_chain_id" label="Prompt chain" hint="All chains makes this example available globally." error={state.errors?.prompt_chain_id}>
          <select id="prompt_chain_id" name="prompt_chain_id" value={values.prompt_chain_id} onChange={event => setValue('prompt_chain_id', event.target.value)} aria-invalid={!!state.errors?.prompt_chain_id} aria-describedby={`prompt_chain_id-hint${state.errors?.prompt_chain_id ? ' prompt_chain_id-error' : ''}`} className={inputClass}>
            <option value="">All chains</option>
            {props.chains.map(chain => <option key={chain.id} value={chain.id}>{chain.name}{chain.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        </AdminFormField>
        {field('image_id', 'Image ID (optional)', 36, false, false, 'Use an image ID from generation request details. Leave blank for a text-only example.')}
      </>}
      <label className="flex items-center gap-3 text-sm font-bold"><input name="is_active" type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="h-4 w-4" />Active</label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? 'Saving…' : record ? 'Save changes' : kind === 'terms' ? 'Create term' : 'Create example'}</button>
        <Link href={`/admin/${kind}`} className="text-sm font-bold underline">Cancel</Link>
      </div>
    </fieldset>
  </form>
}

export function DeleteContentForm({ kind, record }: { kind: ContentKind; record: Term | GenerationExample }) {
  const [state, formAction, pending] = useActionState(deleteContentRecord.bind(null, kind), initialMutationState)
  const [confirmed, setConfirmed] = useState(false)
  const noun = kind === 'terms' ? 'term' : 'example'
  const label = 'term' in record ? record.term : record.caption
  return <form action={formAction} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={record} />
    <MutationFeedback state={state} />
    <p className="break-words text-sm">Permanently delete this {noun}: <strong>{label}</strong>?</p>
    <p className="text-sm text-[var(--color-muted)]">This cannot be undone. Existing generation history{kind === 'generation-examples' ? ' and uploaded images' : ''} will remain.</p>
    <label className="flex items-center gap-3 text-sm font-bold"><input name="confirm_delete" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="h-4 w-4" />I confirm deleting this {noun}.</label>
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending || !confirmed} className={`${buttonClass} bg-rose-100 text-rose-800`}>{pending ? 'Deleting…' : `Delete ${noun}`}</button>
      <Link href={`/admin/${kind}`} className="text-sm font-bold underline">Cancel</Link>
    </div>
  </form>
}
