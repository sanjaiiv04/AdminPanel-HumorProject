'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { saveSignupEntry, deleteSignupEntry } from '@/app/admin/signup-access/actions'
import { initialMutationState } from '@/lib/admin/catalog-validation'
import { signupDefinitions, signupHref, type SignupEntry, type SignupKind } from '@/lib/admin/signup-access'
import { MutationFeedback, RecordIdentity } from './catalog-forms'
import { AdminFormField } from './ui'

const inputClass = 'w-full rounded-lg border-2 border-[var(--color-ink)] bg-white px-3 py-2 text-sm'
const buttonClass = 'rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold disabled:opacity-50'

export function SignupAccessForm({ kind, entry }: { kind: SignupKind; entry?: SignupEntry }) {
  const definition = signupDefinitions[kind]
  const [state, action, pending] = useActionState(saveSignupEntry.bind(null, kind), initialMutationState)
  const [value, setValue] = useState(entry?.[definition.field] ?? '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [active, setActive] = useState(entry?.is_active ?? true)
  const fieldError = state.errors?.[definition.field]
  return <form action={action} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={entry} />
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <AdminFormField id={definition.field} label={kind === 'domains' ? 'Domain' : 'Email address'} hint={kind === 'domains' ? 'Enter columbia.edu, without @ or https://. Subdomains are separate entries.' : 'Enter one full email address. Plus-addresses are kept as entered.'} error={fieldError}>
        <input id={definition.field} name={definition.field} type={kind === 'emails' ? 'email' : 'text'} value={value} onChange={event => setValue(event.target.value)} required maxLength={kind === 'domains' ? 253 : 254} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} aria-invalid={!!fieldError} aria-describedby={`${definition.field}-hint${fieldError ? ` ${definition.field}-error` : ''}`} className={inputClass} />
      </AdminFormField>
      {kind === 'emails' && <AdminFormField id="note" label="Note (optional)" error={state.errors?.note}>
        <textarea id="note" name="note" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} aria-invalid={!!state.errors?.note} aria-describedby={state.errors?.note ? 'note-error' : undefined} className={inputClass} />
      </AdminFormField>}
      <label className="flex items-center gap-3 text-sm font-bold"><input name="is_active" type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="h-4 w-4" />Active</label>
      <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending} className={`${buttonClass} bg-[var(--color-skip)]`}>{pending ? 'Saving…' : entry ? 'Save changes' : `Add ${definition.noun}`}</button><Link href={signupHref(kind)} className="text-sm font-bold underline">Cancel</Link></div>
    </fieldset>
  </form>
}

export function DeleteSignupAccessForm({ kind, entry }: { kind: SignupKind; entry: SignupEntry }) {
  const definition = signupDefinitions[kind]
  const [state, action, pending] = useActionState(deleteSignupEntry.bind(null, kind), initialMutationState)
  const [confirmed, setConfirmed] = useState(false)
  return <form action={action} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={entry} />
    <MutationFeedback state={state} />
    <p className="break-words text-sm">Permanently remove <strong>{entry[definition.field]}</strong> from {kind === 'domains' ? 'allowed domains' : 'whitelisted emails'}?</p>
    <p className="text-sm text-[var(--color-muted)]">This cannot be undone. It removes this additional signup/sign-in allowance. Columbia UNI access and other matching active entries still apply. Existing accounts and sessions are not deleted.</p>
    <label className="flex items-center gap-3 text-sm font-bold"><input name="confirm_delete" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="h-4 w-4" />I confirm removing this entry.</label>
    <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending || !confirmed} className={`${buttonClass} bg-rose-100 text-rose-800`}>{pending ? 'Removing…' : `Remove ${definition.noun}`}</button><Link href={signupHref(kind)} className="text-sm font-bold underline">Cancel</Link></div>
  </form>
}
