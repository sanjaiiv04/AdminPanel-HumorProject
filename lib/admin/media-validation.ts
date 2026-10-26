export const MEDIA_PAGE_SIZE = 12
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024
export const MAX_LEGACY_IMAGE_BYTES = 10 * 1024 * 1024
export const mediaImageSelect = 'id, uploaded_by, storage_bucket, storage_path, original_filename, mime_type, size_bytes, alt_text, created_at, updated_at'
export const savedMediaSelect = 'id, user_id, image_url, caption, created_at'

export interface SavedMedia {
  id: string
  user_id: string
  image_url: string
  caption: string | null
  created_at: string
}
export interface MediaImage {
  id: string
  uploaded_by: string | null
  storage_bucket: string
  storage_path: string
  original_filename: string | null
  mime_type: string
  size_bytes: number | null
  alt_text: string | null
  created_at: string
  updated_at: string
}
export class MediaError extends Error {}

export function formText(form: FormData, key: string, maximum = 2000): string {
  const raw = form.get(key)
  if (raw !== null && typeof raw !== 'string') throw new MediaError('Invalid form field. Reload the page and try again.')
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value.length > maximum) throw new MediaError(`${key === 'alt_text' ? 'Alt text' : key === 'original_filename' ? 'Filename' : 'Caption'} must be at most ${maximum} characters.`)
  return value
}

export function localMediaPath(url: string, projectUrl: string): string | null {
  try {
    const parsed = new URL(url)
    const prefix = '/storage/v1/object/public/generations/'
    if (parsed.origin !== new URL(projectUrl).origin || !parsed.pathname.startsWith(prefix) || parsed.search || parsed.hash || parsed.username || parsed.password) return null
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length))
    return safeMediaPath(path) ? path : null
  } catch { return null }
}

export function safeMediaPath(path: string) {
  return !!path && !/[\\\x00-\x1f]/.test(path) && path.split('/').every(part => part !== '.' && part !== '..' && part !== '')
}

const imageExtensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export async function validateMediaFile(file: File) {
  if (!file.size || file.size > MAX_MEDIA_BYTES) throw new MediaError('Choose an image between 1 byte and 4 MB.')
  const extension = imageExtensions[file.type]
  if (!extension) throw new MediaError('Use a JPEG, PNG, WebP, or GIF image.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  const valid = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    : file.type === 'image/webp' ? ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    : ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a'
  if (!valid) throw new MediaError('The file contents do not match the selected image type.')
  return { extension, mimeType: file.type }
}
