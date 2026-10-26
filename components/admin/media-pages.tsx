import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isResourceId, resourcePage, type ResourceSearchParams } from '@/lib/admin/read-resources'
import { mediaImageSelect, savedMediaSelect, MEDIA_PAGE_SIZE, localMediaPath, type MediaImage, type SavedMedia } from '@/lib/admin/media-validation'
import { mediaPublicUrl, registeredImage } from '@/lib/admin/media-service'
import { AdminDetails, AdminNotice, AdminPageHeader, AdminPagination } from './ui'
import { DeleteMediaForm, ImageMetadataForm, MediaEditForm, RegisterMediaImageForm } from './media-forms'

const linkClass = 'text-sm font-bold underline underline-offset-2'
const buttonClass = 'inline-block rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-skip)] px-4 py-2 text-sm font-bold'
const LoadingMedia = () => <div role="status" className="rounded-xl bg-white p-6 text-sm">Loading media…</div>

function MediaLoadError({ message, href }: { message: string; href: string }) {
  return <AdminNotice title="Unable to load media" error><p>{message}</p><a className={`${linkClass} mt-3 inline-block`} href={href}>Try again</a></AdminNotice>
}

function Preview({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="max-h-96 w-full rounded-xl border-2 border-[var(--color-ink)] bg-white object-contain" />
}

async function MediaGallery({ searchParams }: { searchParams: ResourceSearchParams }) {
  await connection()
  const params = await searchParams
  const images = params.tab === 'images'
  const page = resourcePage(params.page)
  const offset = (page - 1) * MEDIA_PAGE_SIZE
  const href = (target: number) => `/admin/media?${new URLSearchParams({ tab: images ? 'images' : 'media', page: String(target) })}`
  const supabase = await createClient()
  let query = images ? supabase.from('images').select(mediaImageSelect).eq('storage_bucket', 'generations') : supabase.from('generations').select(savedMediaSelect)
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + MEDIA_PAGE_SIZE)
  const { data, error } = await query.overrideTypes<(SavedMedia | MediaImage)[], { merge: false }>()
  if (error) return <MediaLoadError message={error.message} href={href(page)} />
  const records = data ?? []
  const notice = typeof params.notice === 'string' ? {
    created: images ? 'Image uploaded' : 'Saved media created', updated: 'Changes saved',
    deleted: images ? 'Unused image deleted' : 'Saved media removed; original image retained', registered: 'Image added to the uploaded-image library',
  }[params.notice] : null

  return <div className="space-y-5">
    <nav aria-label="Media views" className="flex flex-wrap gap-3">
      <Link href="/admin/media" aria-current={!images ? 'page' : undefined} className={`rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold ${!images ? 'bg-[var(--color-skip)]' : 'bg-white'}`}>Saved media</Link>
      <Link href="/admin/media?tab=images" aria-current={images ? 'page' : undefined} className={`rounded-xl border-2 border-[var(--color-ink)] px-4 py-2 text-sm font-bold ${images ? 'bg-[var(--color-skip)]' : 'bg-white'}`}>Uploaded images</Link>
    </nav>
    {notice && <AdminNotice title={notice} />}
    <div className="flex flex-wrap gap-4"><Link className={buttonClass} href={images ? '/admin/media/upload' : '/admin/media/new'}>{images ? 'Upload image' : 'Create saved media'}</Link></div>
    {images && <p className="text-sm text-[var(--color-muted)]">Includes images from generation attempts, even if no caption was saved. Older images can be registered from their saved-media edit page. Images used by history or examples are protected from deletion.</p>}
    {records.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {records.slice(0, MEDIA_PAGE_SIZE).map(record => {
        const image = 'storage_path' in record ? record : null
        const media = 'image_url' in record ? record : null
        let url = media?.image_url ?? ''
        if (image) { try { url = mediaPublicUrl(supabase, image) } catch { url = '' } }
        return <article key={record.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border-[3px] border-[var(--color-ink)] bg-white">
          {url && <Preview src={url} alt={image?.alt_text ?? media?.caption ?? 'Uploaded image'} />}
          <div className="flex flex-1 flex-col gap-3 p-4">
            <p className="break-words font-bold">{media ? media.caption || 'No caption' : image?.original_filename || image?.storage_path.split('/').at(-1)}</p>
            <p className="text-xs text-[var(--color-muted)]">{new Date(record.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
            {image && <><p className="text-xs">{image.mime_type}{image.size_bytes !== null ? ` · ${(image.size_bytes / 1024).toFixed(1)} KB` : ''}</p><p className="select-all break-all font-mono text-xs" title="Image ID">{image.id}</p></>}
            <div className="mt-auto flex flex-wrap gap-4 pt-2">
              <Link className={linkClass} href={image ? `/admin/media/images/${record.id}/edit` : `/admin/media/${record.id}/edit`}>{image ? 'Image details' : 'Edit / replace image'}</Link>
              {image && <Link className={linkClass} href={`/admin/media/new?imageId=${image.id}`}>Create caption</Link>}
              <Link className={`${linkClass} text-rose-700`} href={image ? `/admin/media/images/${record.id}/delete` : `/admin/media/${record.id}/delete`}>Delete</Link>
            </div>
          </div>
        </article>
      })}
    </div> : <AdminNotice title={page > 1 ? 'No media on this page' : images ? 'No uploaded images yet' : 'No saved media yet'}><Link className={linkClass} href={href(1)}>View the first page</Link></AdminNotice>}
    <AdminPagination page={page} previousHref={page > 1 ? href(page - 1) : undefined} nextHref={records.length > MEDIA_PAGE_SIZE ? href(page + 1) : undefined} />
  </div>
}

export function MediaGalleryPage({ searchParams }: { searchParams: ResourceSearchParams }) {
  return <div className="space-y-6"><AdminPageHeader title="AI Media" description="Manage saved captions and their images, upload new assets, or reuse an existing image." /><Suspense fallback={<LoadingMedia />}><MediaGallery searchParams={searchParams} /></Suspense></div>
}

async function MediaEditor({ params, imageMode, deleting, uploadOnly, searchParams }: { params?: Promise<{ id: string }>; imageMode?: boolean; deleting?: boolean; uploadOnly?: boolean; searchParams?: ResourceSearchParams }) {
  await connection()
  const supabase = await createClient()
  if (!params) {
    const imageId = searchParams ? (await searchParams).imageId : undefined
    if (imageId !== undefined) {
      if (!isResourceId(imageId)) notFound()
      const { data, error } = await supabase.from('images').select(mediaImageSelect).eq('id', imageId).maybeSingle().overrideTypes<MediaImage, { merge: false }>()
      if (error) return <MediaLoadError message={error.message} href={`/admin/media/new?imageId=${imageId}`} />
      if (!data) notFound()
      return <div className="space-y-5"><Preview src={mediaPublicUrl(supabase, data)} alt={data.alt_text ?? 'Existing image'} /><MediaEditForm existingImage={data} /></div>
    }
    return <MediaEditForm uploadOnly={uploadOnly} />
  }
  const { id } = await params
  if (!isResourceId(id)) notFound()
  if (imageMode) {
    const { data, error } = await supabase.from('images').select(mediaImageSelect).eq('id', id).maybeSingle().overrideTypes<MediaImage, { merge: false }>()
    if (error) return <MediaLoadError message={error.message} href={`/admin/media/images/${id}/${deleting ? 'delete' : 'edit'}`} />
    if (!data) notFound()
    const url = mediaPublicUrl(supabase, data)
    return <div className="space-y-5"><Preview src={url} alt={data.alt_text ?? 'Uploaded image'} /><AdminDetails title="Image details" fields={[
      { label: 'Image ID', value: data.id }, { label: 'Storage path', value: data.storage_path },
      { label: 'Image type', value: data.mime_type }, { label: 'Size (bytes)', value: data.size_bytes },
    ]} />{deleting ? <DeleteMediaForm image={data} /> : <ImageMetadataForm image={data} />}</div>
  }
  const { data, error } = await supabase.from('generations').select(savedMediaSelect).eq('id', id).maybeSingle().overrideTypes<SavedMedia, { merge: false }>()
  if (error) return <MediaLoadError message={error.message} href={`/admin/media/${id}/${deleting ? 'delete' : 'edit'}`} />
  if (!data) notFound()
  const path = localMediaPath(data.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL!)
  const image = path ? await registeredImage(supabase, path) : null
  return <div className="space-y-5"><Preview src={data.image_url} alt={data.caption ?? 'Saved media image'} />
    {deleting ? <DeleteMediaForm media={data} /> : <><MediaEditForm media={data} />{image ? <Link href={`/admin/media/images/${image.id}/edit`} className={linkClass}>View image details · {image.id}</Link> : path ? <RegisterMediaImageForm media={data} /> : null}</>}
  </div>
}

export function MediaEditorPage(props: { params?: Promise<{ id: string }>; imageMode?: boolean; deleting?: boolean; uploadOnly?: boolean; searchParams?: ResourceSearchParams }) {
  const noun = props.imageMode || props.uploadOnly ? 'image' : 'saved media'
  return <div className="space-y-6"><Link href={`/admin/media${props.imageMode || props.uploadOnly ? '?tab=images' : ''}`} className={linkClass}>← Back to AI Media</Link><AdminPageHeader title={`${props.deleting ? 'Delete' : props.params ? 'Edit' : props.uploadOnly ? 'Upload' : 'Create'} ${noun}`} description={props.deleting ? 'Review this item before confirming deletion.' : 'Manage this item and its image details.'} /><Suspense fallback={<LoadingMedia />}><MediaEditor {...props} /></Suspense></div>
}
