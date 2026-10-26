'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createMedia, deleteMediaRecord, registerMediaImage, updateImageMetadata, updateSavedMedia } from '@/app/admin/media/actions'
import { initialMutationState } from '@/lib/admin/catalog-validation'
import type { MediaImage, SavedMedia } from '@/lib/admin/media-validation'
import { MAX_MEDIA_BYTES } from '@/lib/admin/media-validation'
import { MutationFeedback, RecordIdentity } from './catalog-forms'
import { AdminFormField } from './ui'

const inputClass = 'w-full rounded-lg border-2 border-[var(--color-ink)] bg-white px-3 py-2 text-sm'
const buttonClass = 'rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold disabled:opacity-50'

function SavedIdentity({ media }: { media: SavedMedia }) {
  return <><input type="hidden" name="id" value={media.id} /><input type="hidden" name="original_url" value={media.image_url} /><input type="hidden" name="original_caption" value={media.caption ?? ''} /></>
}

export function MediaEditForm({ media, existingImage, uploadOnly = false }: { media?: SavedMedia; existingImage?: MediaImage; uploadOnly?: boolean }) {
  const [state, action, pending] = useActionState(media ? updateSavedMedia : createMedia, initialMutationState)
  const [caption, setCaption] = useState(media?.caption ?? '')
  const [altText, setAltText] = useState('')
  const [fileError, setFileError] = useState('')
  return <form action={action} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    {media ? <SavedIdentity media={media} /> : <input type="hidden" name="mode" value={uploadOnly ? 'upload-only' : 'saved-media'} />}
    {existingImage && <input type="hidden" name="image_id" value={existingImage.id} />}
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      {!uploadOnly && <AdminFormField id="caption" label="Caption (optional)">
        <textarea id="caption" name="caption" rows={3} maxLength={2000} value={caption} onChange={event => setCaption(event.target.value)} className={inputClass} />
      </AdminFormField>}
      {!existingImage && <>
        <AdminFormField id="file" label={media ? 'Replace image (optional)' : 'Image file'} hint="JPEG, PNG, WebP, or GIF. Maximum 4 MB." error={fileError || undefined}>
          <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!media} aria-invalid={!!fileError} aria-describedby={`file-hint${fileError ? ' file-error' : ''}`} onChange={event => setFileError((event.target.files?.[0]?.size ?? 0) > MAX_MEDIA_BYTES ? 'Choose an image no larger than 4 MB.' : '')} className={inputClass} />
        </AdminFormField>
        <AdminFormField id="alt_text" label="Alt text for the new image (optional)">
          <input id="alt_text" name="alt_text" value={altText} onChange={event => setAltText(event.target.value)} maxLength={500} className={inputClass} />
        </AdminFormField>
      </>}
      {media && <p className="text-sm text-[var(--color-muted)]">Leave the file empty to keep the current image. Replacement creates a new image; the original remains available to history and examples.</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending || !!fileError} className={`${buttonClass} bg-[var(--color-skip)]`}>{pending ? 'Saving…' : media ? 'Save changes' : uploadOnly ? 'Upload image' : 'Create saved media'}</button>
        <Link href={`/admin/media${uploadOnly ? '?tab=images' : ''}`} className="text-sm font-bold underline">Cancel</Link>
      </div>
    </fieldset>
  </form>
}

export function ImageMetadataForm({ image }: { image: MediaImage }) {
  const [state, action, pending] = useActionState(updateImageMetadata, initialMutationState)
  const [filename, setFilename] = useState(image.original_filename ?? '')
  const [alt, setAlt] = useState(image.alt_text ?? '')
  return <form action={action} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    <RecordIdentity record={image} />
    <MutationFeedback state={state} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <AdminFormField id="original_filename" label="Display filename (optional)" hint="Renaming this label does not change the image URL.">
        <input id="original_filename" name="original_filename" maxLength={255} value={filename} onChange={event => setFilename(event.target.value)} aria-describedby="original_filename-hint" className={inputClass} />
      </AdminFormField>
      <AdminFormField id="alt_text" label="Alt text (optional)">
        <input id="alt_text" name="alt_text" maxLength={500} value={alt} onChange={event => setAlt(event.target.value)} className={inputClass} />
      </AdminFormField>
      <p className="text-sm text-[var(--color-muted)]">To replace an image on a caption, edit that saved media item. Source images used in history stay unchanged.</p>
      <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending} className={`${buttonClass} bg-[var(--color-skip)]`}>{pending ? 'Saving…' : 'Save image details'}</button><Link href="/admin/media?tab=images" className="text-sm font-bold underline">Cancel</Link></div>
    </fieldset>
  </form>
}

export function RegisterMediaImageForm({ media }: { media: SavedMedia }) {
  const [state, action, pending] = useActionState(registerMediaImage, initialMutationState)
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={media.id} />
    <MutationFeedback state={state} />
    <button type="submit" disabled={pending} className={`${buttonClass} bg-[var(--color-skip)]`}>{pending ? 'Registering…' : 'Add original image to uploaded-image library'}</button>
  </form>
}

export function DeleteMediaForm(props: { media: SavedMedia; image?: never } | { image: MediaImage; media?: never }) {
  const kind = props.image ? 'image' : 'media'
  const [state, action, pending] = useActionState(deleteMediaRecord.bind(null, kind), initialMutationState)
  const [confirmed, setConfirmed] = useState(false)
  return <form action={action} className="space-y-5 rounded-2xl border-[3px] border-[var(--color-ink)] bg-white p-6">
    {props.image ? <RecordIdentity record={props.image} /> : <SavedIdentity media={props.media} />}
    <MutationFeedback state={state} />
    {props.media?.caption && <blockquote className="whitespace-pre-wrap break-words text-sm font-bold">{props.media.caption}</blockquote>}
    <p className="text-sm">{kind === 'image' ? 'This permanently removes the image file and its metadata. Images referenced by saved media, generation history, or examples cannot be deleted.' : 'This removes the saved caption from AI Media. The original image is retained in Uploaded images so history, other captions, and examples stay intact. Unused images can be deleted there separately.'}</p>
    <label className="flex items-center gap-3 text-sm font-bold"><input name="confirm_delete" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={pending} className="h-4 w-4" />I confirm this deletion.</label>
    <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending || !confirmed} className={`${buttonClass} bg-rose-100 text-rose-800`}>{pending ? 'Deleting…' : kind === 'image' ? 'Delete unused image' : 'Delete saved media'}</button><Link href={`/admin/media${kind === 'image' ? '?tab=images' : ''}`} className="text-sm font-bold underline">Cancel</Link></div>
  </form>
}
