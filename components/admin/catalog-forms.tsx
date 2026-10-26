'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { deleteCatalogRecord, saveModel, saveProvider, updateChainMix } from '@/app/admin/catalog-actions'
import {
  initialMutationState, type CatalogKind, type MixEntry, type Model,
  type MutationState, type Provider,
} from '@/lib/admin/catalog-validation'
import { AdminFormField, AdminNotice } from './ui'
import { catalogHref } from '@/lib/admin/catalog-navigation'

const inputClass = 'w-full rounded-lg border-2 border-[var(--color-ink)] bg-white px-3 py-2 text-sm'
const buttonClass = 'rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold disabled:opacity-50'

export function MutationFeedback({ state }: { state: MutationState }) {
  if (!state.message) return null
  return <AdminNotice title={state.message} error={state.status === 'error'}>
    {state.errors?.id || state.errors?.updated_at}
  </AdminNotice>
}

export function RecordIdentity({ record }: { record?: { id: string; updated_at: string } }) {
  return record && <><input type="hidden" name="id" value={record.id} /><input type="hidden" name="updated_at" value={record.updated_at} /></>
}

type CatalogFormProps =
  | { kind: 'providers'; record?: Provider }
  | { kind: 'models'; record?: Model; providers: Pick<Provider, 'id' | 'name' | 'is_active'>[] }

export function CatalogForm(props: CatalogFormProps) {
  const { kind, record } = props
  const model = record && 'provider_id' in record ? record : undefined
  const [state, formAction, pending] = useActionState(kind === 'providers' ? saveProvider : saveModel, initialMutationState)
  // Controlled fields preserve entered values when a server validation fails.
  const [name, setName] = useState(record?.name ?? '')
  const [slug, setSlug] = useState(record && 'slug' in record ? record.slug : '')
  const [providerId, setProviderId] = useState(model?.provider_id ?? '')
  const [identifier, setIdentifier] = useState(model?.model_identifier ?? '')
  const [active, setActive] = useState(record?.is_active ?? true)
  const [images, setImages] = useState(model?.supports_images ?? true)
  const errorFor = (key: string) => state.errors?.[key]

  return <form action={formAction} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={record} />
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <AdminFormField id="name" label="Display name" error={errorFor('name')}>
        <input id="name" name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} aria-invalid={!!errorFor('name')} aria-describedby={errorFor('name') ? 'name-error' : undefined} className={inputClass} />
      </AdminFormField>
      {kind === 'providers' ? <AdminFormField id="slug" label="Provider slug" hint="A unique lowercase identifier, such as google." error={errorFor('slug')}>
        <input id="slug" name="slug" value={slug} onChange={event => setSlug(event.target.value)} required maxLength={64} pattern="[a-z][a-z0-9_\-]*" aria-invalid={!!errorFor('slug')} aria-describedby={`slug-hint${errorFor('slug') ? ' slug-error' : ''}`} className={inputClass} />
      </AdminFormField> : <>
        <AdminFormField id="provider_id" label="Provider" error={errorFor('provider_id')}>
          <select id="provider_id" name="provider_id" value={providerId} onChange={event => setProviderId(event.target.value)} required aria-invalid={!!errorFor('provider_id')} aria-describedby={errorFor('provider_id') ? 'provider_id-error' : undefined} className={inputClass}>
            <option value="">Choose a provider</option>
            {props.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}{provider.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        </AdminFormField>
        <AdminFormField id="model_identifier" label="Model identifier" hint="Use the exact model identifier accepted by the provider." error={errorFor('model_identifier')}>
          <input id="model_identifier" name="model_identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} required maxLength={200} aria-invalid={!!errorFor('model_identifier')} aria-describedby={`model_identifier-hint${errorFor('model_identifier') ? ' model_identifier-error' : ''}`} className={inputClass} />
        </AdminFormField>
        <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="supports_images" checked={images} onChange={event => setImages(event.target.checked)} className="h-4 w-4" />Supports image input</label>
      </>}
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="is_active" checked={active} onChange={event => setActive(event.target.checked)} className="h-4 w-4" />Active</label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? 'Saving…' : record ? 'Save changes' : `Create ${kind === 'providers' ? 'provider' : 'model'}`}</button>
        <Link href={catalogHref(kind)} className="text-sm font-bold underline">Cancel</Link>
      </div>
    </fieldset>
  </form>
}

export function DeleteCatalogForm({ kind, record }: { kind: CatalogKind; record: Provider | Model }) {
  const [state, formAction, pending] = useActionState(deleteCatalogRecord.bind(null, kind), initialMutationState)
  const [confirmed, setConfirmed] = useState(false)
  const noun = kind === 'providers' ? 'provider' : 'model'
  return <form action={formAction} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={record} />
    <MutationFeedback state={state} />
    <p className="text-sm">Permanently delete <strong>{record.name}</strong>? This cannot be undone.</p>
    <p className="text-sm text-[var(--color-muted)]">{kind === 'providers' ? 'Providers used by models cannot be deleted.' : 'Models used by prompt chain steps cannot be deleted. Existing response history keeps its model identifier.'}</p>
    <label className="flex items-center gap-3 text-sm font-bold"><input name="confirm_delete" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="h-4 w-4" />I confirm deleting this {noun}.</label>
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending || !confirmed} className={`${buttonClass} bg-rose-100 text-rose-800`}>{pending ? 'Deleting…' : `Delete ${noun}`}</button>
      <Link href={catalogHref(kind)} className="text-sm font-bold underline">Cancel</Link>
    </div>
  </form>
}

export function ChainMixForm({ entry }: { entry: MixEntry }) {
  const [state, formAction, pending] = useActionState(updateChainMix, initialMutationState)
  const [weight, setWeight] = useState(String(entry.weight))
  const [enabled, setEnabled] = useState(entry.is_enabled)
  const weightId = `weight-${entry.id}`
  return <form action={formAction} className="space-y-3">
    <RecordIdentity record={entry} />
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="flex flex-wrap items-end gap-3 disabled:opacity-60">
      <AdminFormField id={weightId} label="Weight" error={state.errors?.weight}>
        <input id={weightId} name="weight" inputMode="decimal" type="number" min="0.000001" max="999999.999999" step="0.000001" value={weight} onChange={event => setWeight(event.target.value)} required aria-invalid={!!state.errors?.weight} aria-describedby={state.errors?.weight ? `${weightId}-error` : undefined} className={`${inputClass} max-w-40`} />
      </AdminFormField>
      <label className="flex items-center gap-2 py-2 text-sm font-bold"><input name="is_enabled" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-4 w-4" />Enabled<span className="sr-only"> for {entry.chain?.name ?? 'this chain'}</span></label>
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? 'Saving…' : 'Save mix'}</button>
    </fieldset>
  </form>
}
