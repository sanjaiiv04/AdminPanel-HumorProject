import type { SupabaseClient } from '@supabase/supabase-js'
import { isResourceId } from '@/lib/admin/read-resources'
import { mediaImageSelect, savedMediaSelect, localMediaPath, safeMediaPath, validateMediaFile, MAX_LEGACY_IMAGE_BYTES, MediaError, type MediaImage, type SavedMedia } from '@/lib/admin/media-validation'

export function mediaPublicUrl(db: SupabaseClient, image: Pick<MediaImage, 'storage_bucket' | 'storage_path'>) {
  if (image.storage_bucket !== 'generations' || !safeMediaPath(image.storage_path)) throw new MediaError('This image is outside the managed media bucket.')
  return db.storage.from('generations').getPublicUrl(image.storage_path).data.publicUrl
}

export async function savedMediaRecord(db: SupabaseClient, id: string) {
  if (!isResourceId(id)) throw new MediaError('Invalid media ID.')
  const { data, error } = await db.from('generations').select(savedMediaSelect).eq('id', id).maybeSingle().overrideTypes<SavedMedia, { merge: false }>()
  if (error) throw new MediaError('Could not load this saved media.')
  if (!data) throw new MediaError('This saved media was removed or is unavailable.')
  return data
}

export async function imageRecord(db: SupabaseClient, id: string) {
  if (!isResourceId(id)) throw new MediaError('Invalid image ID.')
  const { data, error } = await db.from('images').select(mediaImageSelect).eq('id', id).maybeSingle().overrideTypes<MediaImage, { merge: false }>()
  if (error) throw new MediaError('Could not load this image.')
  if (!data) throw new MediaError('This image was removed or is unavailable.')
  return data
}

export async function registeredImage(db: SupabaseClient, path: string) {
  const { data, error } = await db.from('images').select(mediaImageSelect).eq('storage_bucket', 'generations').eq('storage_path', path).maybeSingle().overrideTypes<MediaImage, { merge: false }>()
  if (error) throw new MediaError('Could not check image metadata.')
  return data
}

export async function uploadMediaImage(db: SupabaseClient, actorId: string, file: File, altText: string) {
  const { extension, mimeType } = await validateMediaFile(file)
  const path = `${actorId}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await db.storage.from('generations').upload(path, file, { contentType: mimeType, upsert: false })
  if (uploadError) throw new MediaError('Image upload failed. Check your connection and storage permissions.')
  const { data, error } = await db.from('images').insert({
    uploaded_by: actorId, storage_bucket: 'generations', storage_path: path,
    original_filename: file.name.slice(0, 255), mime_type: mimeType, size_bytes: file.size, alt_text: altText || null,
  }).select(mediaImageSelect).single().overrideTypes<MediaImage, { merge: false }>()
  if (error || !data) {
    let cleaned = false
    try {
      const result = await db.storage.from('generations').remove([path])
      cleaned = !result.error && !!result.data?.some(object => object.name === path)
    } catch { /* A failed cleanup must not be reported as a successful removal. */ }
    throw new MediaError(!cleaned ? 'Metadata could not be saved and upload cleanup could not be confirmed. The file may remain in storage; do not retry repeatedly.' : 'Metadata could not be saved. The uploaded file was cleaned up; please retry.')
  }
  return data
}

// Register older saved-media images only on explicit mutation, never during GET.
export async function registerSavedImage(db: SupabaseClient, media: SavedMedia, projectUrl: string, fetcher = fetch) {
  const path = localMediaPath(media.image_url, projectUrl)
  if (!path) return null // External images are never deleted or fetched by this service.
  const existing = await registeredImage(db, path)
  if (existing) return existing
  const response = await fetcher(media.image_url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  if (!response.ok || !mimeType.startsWith('image/')) throw new MediaError('Could not read the original image. Its saved caption was left unchanged.')
  if (Number(response.headers.get('content-length')) > MAX_LEGACY_IMAGE_BYTES) throw new MediaError('This legacy image is larger than 10 MB; it must be reviewed separately before removal.')
  const reader = response.body?.getReader()
  if (!reader) throw new MediaError('The original image could not be read.')
  let size = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > MAX_LEGACY_IMAGE_BYTES) { await reader.cancel(); throw new MediaError('This legacy image is larger than 10 MB; review it separately.') }
  }
  const { data, error } = await db.from('images').upsert({
    uploaded_by: media.user_id, storage_bucket: 'generations', storage_path: path, mime_type: mimeType, size_bytes: size,
  }, { onConflict: 'storage_bucket,storage_path', ignoreDuplicates: true }).select(mediaImageSelect).maybeSingle().overrideTypes<MediaImage, { merge: false }>()
  if (error) throw new MediaError('Could not register the original image. The saved media was left unchanged.')
  const result = data ?? await registeredImage(db, path)
  if (!result) throw new MediaError('Could not register the original image. Please retry.')
  return result
}

export function assertMediaUnchanged(record: SavedMedia, originalUrl: string, originalCaption: string) {
  if (record.image_url !== originalUrl || (record.caption ?? '') !== originalCaption) throw new MediaError('This media changed after you opened it. Reload before saving or deleting.')
}

export function matchingMedia(db: SupabaseClient, record: SavedMedia, deleting = false, values?: { caption: string | null; image_url: string }) {
  const query = deleting ? db.from('generations').delete() : db.from('generations').update(values!)
  const matched = query.eq('id', record.id).eq('image_url', record.image_url)
  return record.caption === null ? matched.is('caption', null) : matched.eq('caption', record.caption)
}

export async function deleteSavedMedia(db: SupabaseClient, record: SavedMedia, projectUrl: string) {
  // Retain the original image so requests, examples and other captions stay valid.
  await registerSavedImage(db, record, projectUrl)
  const { data, error } = await matchingMedia(db, record, true).select('id').maybeSingle()
  if (error) throw new MediaError('This saved media could not be removed. It may be referenced by votes or another record. Its image was retained.')
  if (!data) throw new MediaError('This media changed or was removed. Reload before trying again.')
}

export async function deleteUnusedImage(db: SupabaseClient, image: MediaImage) {
  const url = mediaPublicUrl(db, image)
  const checks = await Promise.all([
    db.from('generations').select('id', { count: 'exact', head: true }).eq('image_url', url),
    db.from('generation_requests').select('id', { count: 'exact', head: true }).eq('image_id', image.id),
    db.from('ai_generation_examples').select('id', { count: 'exact', head: true }).eq('image_id', image.id),
  ])
  if (checks.some(result => result.error || result.count === null)) throw new MediaError('Could not verify image usage. Nothing was deleted.')
  if (checks.some(result => (result.count ?? 0) > 0)) throw new MediaError('This image is used by saved media, generation history, or a curated example. It was not deleted.')
  // Database removal must succeed before removing the object. If Storage fails,
  // restore metadata so the image remains visible and deletion can be retried.
  const { data, error } = await db.from('images').delete().eq('id', image.id).eq('updated_at', image.updated_at).select('id').maybeSingle()
  if (error) throw new MediaError('Image metadata could not be removed. The storage file was retained.')
  if (!data) throw new MediaError('This image changed or was removed. Reload before trying again.')
  let removed = false
  try {
    const result = await db.storage.from('generations').remove([image.storage_path])
    removed = !result.error && !!result.data?.some(object => object.name === image.storage_path)
  } catch { /* Restore metadata after thrown network errors as well. */ }
  if (!removed) {
    const { error: restoreError } = await db.from('images').insert(image)
    throw new MediaError(restoreError ? 'The storage file was retained, but its metadata could not be restored. Ask an administrator to reconcile this image.' : 'The storage file could not be removed. Its metadata was restored; check storage permissions and try again.')
  }
}
