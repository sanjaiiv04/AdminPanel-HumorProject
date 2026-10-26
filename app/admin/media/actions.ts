'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { authorizedAdminContext } from '@/lib/admin/authorize'
import { validateIdentity, type MutationState } from '@/lib/admin/catalog-validation'
import { formText, MediaError } from '@/lib/admin/media-validation'
import { assertMediaUnchanged, deleteSavedMedia, deleteUnusedImage, imageRecord, matchingMedia, mediaPublicUrl, registerSavedImage, savedMediaRecord, uploadMediaImage } from '@/lib/admin/media-service'

function failure(error: unknown): MutationState {
  const message = error instanceof MediaError || (error instanceof Error && /^(Sign in|Superadmin access)/.test(error.message))
    ? error.message : 'The media change could not be completed. Check your connection and try again.'
  return { status: 'error', message }
}
function projectUrl() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new MediaError('Media storage is not configured.')
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}
function fileFrom(form: FormData, required = false) {
  const file = form.get('file')
  if (file instanceof File && file.size) return file
  if (required) throw new MediaError('Choose an image file.')
  return null
}
function originalValue(form: FormData, key: string, maximum: number) {
  const value = form.get(key)
  if (typeof value !== 'string' || value.length > maximum) throw new MediaError('Reload this media before making changes.')
  return value
}
function success(href: string): never {
  revalidatePath('/admin', 'layout')
  redirect(href)
}

export async function createMedia(_previous: MutationState, form: FormData): Promise<MutationState> {
  let uploadOnly = false
  try {
    const { supabase, user } = await authorizedAdminContext()
    const mode = form.get('mode')
    if (mode !== 'upload-only' && mode !== 'saved-media') throw new MediaError('Invalid upload mode.')
    uploadOnly = mode === 'upload-only'
    const caption = formText(form, 'caption')
    const altText = formText(form, 'alt_text', 500)
    const imageId = formText(form, 'image_id', 36)
    const file = fileFrom(form, !imageId)
    if (file && imageId) throw new MediaError('Choose either an existing image or a new upload.')
    const image = imageId ? await imageRecord(supabase, imageId) : await uploadMediaImage(supabase, user.id, file!, altText)
    if (!uploadOnly) {
      const { data, error } = await supabase.from('generations').insert({ user_id: user.id, caption: caption || null, image_url: mediaPublicUrl(supabase, image) }).select('id').single()
      if (error || !data) throw new MediaError('The caption could not be saved. The image is available under Uploaded images; choose Create caption there to retry without uploading again.')
    }
  } catch (error) { return failure(error) }
  return success(`/admin/media?tab=${uploadOnly ? 'images' : 'media'}&notice=created`)
}

export async function updateSavedMedia(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const { supabase, user } = await authorizedAdminContext()
    const record = await savedMediaRecord(supabase, formText(form, 'id', 36))
    assertMediaUnchanged(record, originalValue(form, 'original_url', 8192), originalValue(form, 'original_caption', 100000))
    const caption = formText(form, 'caption')
    const file = fileFrom(form)
    // Register the original before changing the pair, keeping it discoverable.
    await registerSavedImage(supabase, record, projectUrl())
    const image = file ? await uploadMediaImage(supabase, user.id, file, formText(form, 'alt_text', 500)) : null
    const { data, error } = await matchingMedia(supabase, record, false, {
      caption: caption || null, image_url: image ? mediaPublicUrl(supabase, image) : record.image_url,
    }).select('id').maybeSingle()
    if (error || !data) throw new MediaError('This media changed or could not be saved. Reload before retrying. Any new upload is retained under Uploaded images.')
  } catch (error) { return failure(error) }
  return success('/admin/media?notice=updated')
}

export async function registerMediaImage(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const { supabase } = await authorizedAdminContext()
    const record = await savedMediaRecord(supabase, formText(form, 'id', 36))
    const image = await registerSavedImage(supabase, record, projectUrl())
    if (!image) throw new MediaError('This image is hosted externally and cannot be managed in the uploaded-image library.')
  } catch (error) { return failure(error) }
  return success('/admin/media?tab=images&notice=registered')
}

export async function updateImageMetadata(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const { supabase } = await authorizedAdminContext()
    const identity = validateIdentity(form, true)
    if (Object.keys(identity.errors).length) throw new MediaError('Reload this image before saving changes.')
    const image = await imageRecord(supabase, identity.id)
    mediaPublicUrl(supabase, image)
    const { data, error } = await supabase.from('images').update({
      original_filename: formText(form, 'original_filename', 255) || null,
      alt_text: formText(form, 'alt_text', 500) || null,
    }).eq('id', image.id).eq('updated_at', identity.updatedAt).select('id').maybeSingle()
    if (error || !data) throw new MediaError('This image changed or could not be saved. Reload before trying again.')
  } catch (error) { return failure(error) }
  return success('/admin/media?tab=images&notice=updated')
}

export async function deleteMediaRecord(kind: 'media' | 'image', _previous: MutationState, form: FormData): Promise<MutationState> {
  if (kind !== 'media' && kind !== 'image') return failure(new MediaError('Unknown media type.'))
  try {
    const { supabase } = await authorizedAdminContext()
    if (form.get('confirm_delete') !== 'on') throw new MediaError('Confirm the deletion before continuing.')
    if (kind === 'media') {
      const record = await savedMediaRecord(supabase, formText(form, 'id', 36))
      assertMediaUnchanged(record, originalValue(form, 'original_url', 8192), originalValue(form, 'original_caption', 100000))
      await deleteSavedMedia(supabase, record, projectUrl())
    } else {
      const identity = validateIdentity(form, true)
      if (Object.keys(identity.errors).length) throw new MediaError('Reload this image before deleting it.')
      const image = await imageRecord(supabase, identity.id)
      if (image.updated_at !== identity.updatedAt) throw new MediaError('This image changed. Reload before deleting it.')
      await deleteUnusedImage(supabase, image)
    }
  } catch (error) { return failure(error) }
  return success(`/admin/media?tab=${kind === 'image' ? 'images' : 'media'}&notice=deleted`)
}
