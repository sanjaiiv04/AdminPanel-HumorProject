import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Offline mutation tests: no real database records or storage objects are touched.
const id = '11111111-1111-4111-8111-111111111111'
const imageId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
const updatedAt = '2026-10-26T12:00:00.123456+00:00'
const project = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_URL = project
const urlFor = path => `${project}/storage/v1/object/public/generations/${path}`
const encoded = source => `data:text/javascript,${encodeURIComponent(source)}`
registerHooks({ resolve(specifier, context, nextResolve) {
  const mocks = {
    'server-only': encoded(''),
    'next/cache': encoded('export function revalidatePath() {}'),
    'next/navigation': encoded('export function redirect(url) { throw new Error("REDIRECT:" + url) }'),
    '@/lib/supabase/server': encoded('export async function createClient() { return globalThis.__mediaTest.db }'),
  }
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
  if (specifier.startsWith('@/lib/admin/')) return { url: new URL(`../lib/admin/${specifier.split('/').at(-1)}.ts`, import.meta.url).href, shortCircuit: true }
  return nextResolve(specifier, context)
} })
const validation = await import('../lib/admin/media-validation.ts')
const service = await import('../lib/admin/media-service.ts')
const actions = await import('../app/admin/media/actions.ts')
const { initialMutationState } = await import('../lib/admin/catalog-validation.ts')
const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'original.png', { type: 'image/png' })
const imageFixture = () => ({ id: imageId, uploaded_by: actorId, storage_bucket: 'generations', storage_path: `${actorId}/original.png`, original_filename: 'original.png', mime_type: 'image/png', size_bytes: 9, alt_text: null, created_at: updatedAt, updated_at: updatedAt })
const mediaFixture = () => ({ id, user_id: actorId, image_url: urlFor(imageFixture().storage_path), caption: 'Original caption', created_at: updatedAt })
const form = fields => { const value = new FormData(); for (const [key, field] of Object.entries(fields)) value.set(key, field); return value }
const savedFields = () => ({ id, original_url: mediaFixture().image_url, original_caption: mediaFixture().caption })

function setup(options = {}) {
  const state = {
    admin: true, user: { id: actorId }, events: [], storageCalls: [], errors: {}, countErrors: [], storageError: false, storageThrow: false, emptyRemoval: false,
    tables: { generations: [mediaFixture()], images: [imageFixture()], generation_requests: [], ai_generation_examples: [] }, ...options,
  }
  state.db = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    storage: { from: bucket => ({
      getPublicUrl: path => ({ data: { publicUrl: urlFor(path) } }),
      async upload(path) { state.events.push('storage:upload'); state.storageCalls.push({ operation: 'upload', bucket, path }); return { error: state.uploadError ? {} : null } },
      async remove(paths) {
        state.events.push('storage:remove'); state.storageCalls.push({ operation: 'remove', bucket, paths })
        if (state.storageThrow) throw new Error('network failure')
        return { error: state.storageError ? {} : null, data: state.emptyRemoval || state.storageError ? [] : paths.map(name => ({ name })) }
      },
    }) },
    from(table) {
      const query = { table, operation: 'select', filters: [], values: null, count: false }
      const execute = async () => {
        if (table === 'profiles') return { data: { is_superadmin: state.admin }, error: null }
        const rows = state.tables[table] ?? []
        const matches = row => query.filters.every(([key, value]) => row[key] === value)
        if (query.count) return { count: state.countErrors.includes(table) ? null : rows.filter(matches).length, error: state.countErrors.includes(table) ? {} : null }
        if (query.operation === 'select') return { data: rows.filter(matches), error: null }
        state.events.push(`${table}:${query.operation}`)
        if (state.errors[`${table}:${query.operation}`]) return { data: null, error: { code: 'fake' } }
        if (query.operation === 'delete') {
          const matched = rows.filter(matches)
          state.tables[table] = rows.filter(row => !matches(row))
          return { data: matched, error: null }
        }
        if (query.operation === 'update') {
          const matched = rows.filter(matches)
          for (const row of matched) Object.assign(row, query.values)
          return { data: matched, error: null }
        }
        if (query.operation === 'upsert') {
          const existing = rows.find(row => row.storage_path === query.values.storage_path && row.storage_bucket === query.values.storage_bucket)
          if (existing) return { data: [], error: null }
        }
        const row = { id: crypto.randomUUID(), created_at: updatedAt, updated_at: updatedAt, ...query.values }
        rows.push(row)
        state.tables[table] = rows
        return { data: [row], error: null }
      }
      const builder = {
        select(_fields, options) { query.count = !!options?.head; return builder },
        eq(key, value) { query.filters.push([key, value]); return builder },
        is(key, value) { query.filters.push([key, value]); return builder },
        insert(values) { query.operation = 'insert'; query.values = values; return builder },
        upsert(values) { query.operation = 'upsert'; query.values = values; return builder },
        update(values) { query.operation = 'update'; query.values = values; return builder },
        delete() { query.operation = 'delete'; return builder },
        overrideTypes() { return builder },
        single() { query.single = true; return builder },
        maybeSingle() { query.single = true; return builder },
        then(resolve, reject) { return execute().then(result => query.single && Array.isArray(result.data) ? { ...result, data: result.data[0] ?? null } : result).then(resolve, reject) },
      }
      return builder
    },
  }
  globalThis.__mediaTest = state
  return state
}

test('image validation checks MIME, bytes, and size before upload', async () => {
  assert.equal((await validation.validateMediaFile(png())).extension, 'png')
  await assert.rejects(validation.validateMediaFile(new File(['HTML'], 'fake.png', { type: 'image/png' })), /contents/)
  await assert.rejects(validation.validateMediaFile(new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' })), /JPEG/)
  await assert.rejects(validation.validateMediaFile(new File([], 'empty.png', { type: 'image/png' })), /4 MB/)
  await assert.rejects(validation.validateMediaFile(new File([new Uint8Array(validation.MAX_MEDIA_BYTES + 1)], 'large.png', { type: 'image/png' })), /4 MB/)
})

test('storage parsing never manages foreign origins, other buckets, or unsafe paths', () => {
  assert.equal(validation.localMediaPath(mediaFixture().image_url, project), imageFixture().storage_path)
  for (const url of ['https://foreign.example/image.png', `${project}/storage/v1/object/public/avatars/file.png`, `${mediaFixture().image_url}?x=1`, `${project}/storage/v1/object/public/generations/folder/%2e%2e%2ffile.png`]) assert.equal(validation.localMediaPath(url, project), null)
})

test('new uploads register metadata and use a generated storage path', async () => {
  const state = setup()
  const image = await service.uploadMediaImage(state.db, actorId, png(), 'Alt text')
  assert.equal(image.original_filename, 'original.png')
  assert.equal(image.alt_text, 'Alt text')
  assert.ok(image.storage_path.startsWith(`${actorId}/`))
  assert.notEqual(image.storage_path, `${actorId}/original.png`)
  assert.deepEqual(state.events, ['storage:upload', 'images:insert'])
})

test('failed upload registration cleans up only the new object', async () => {
  const state = setup({ errors: { 'images:insert': true } })
  await assert.rejects(service.uploadMediaImage(state.db, actorId, png(), ''), /cleaned up/)
  const upload = state.storageCalls[0]
  assert.deepEqual(state.storageCalls[1].paths, [upload.path])
  assert.equal(state.tables.images[0].id, imageId)
})

test('unconfirmed upload cleanup is reported honestly', async () => {
  const state = setup({ errors: { 'images:insert': true }, emptyRemoval: true })
  await assert.rejects(service.uploadMediaImage(state.db, actorId, png(), ''), /could not be confirmed/)
})

test('replacing an image preserves the original and registers the replacement', async () => {
  const state = setup()
  await assert.rejects(actions.updateSavedMedia(initialMutationState, form({ ...savedFields(), caption: 'New caption', file: png(), alt_text: '' })), /REDIRECT:/)
  assert.equal(state.tables.generations[0].caption, 'New caption')
  assert.notEqual(state.tables.generations[0].image_url, mediaFixture().image_url)
  assert.equal(state.tables.images.length, 2)
  assert.equal(state.storageCalls.some(call => call.operation === 'remove'), false)
})

test('stale saved-media forms cannot upload or overwrite newer content', async () => {
  const state = setup()
  const result = await actions.updateSavedMedia(initialMutationState, form({ ...savedFields(), original_caption: 'Outdated', caption: 'Overwrite', file: png() }))
  assert.match(result.message, /changed after/)
  assert.equal(state.storageCalls.length, 0)
  assert.equal(state.tables.generations[0].caption, 'Original caption')
})

test('saved-caption deletion never deletes its source storage object', async () => {
  const state = setup()
  await service.deleteSavedMedia(state.db, mediaFixture(), project)
  assert.equal(state.tables.generations.length, 0)
  assert.equal(state.tables.images.length, 1)
  assert.equal(state.storageCalls.length, 0)
})

test('images referenced by captions, history, or examples are retained', async () => {
  for (const table of ['generations', 'generation_requests', 'ai_generation_examples']) {
    const state = setup()
    state.tables.generations = []
    state.tables[table] = table === 'generations' ? [mediaFixture()] : [{ image_id: imageId }]
    await assert.rejects(service.deleteUnusedImage(state.db, imageFixture()), /used by saved media/)
    assert.equal(state.storageCalls.length, 0)
    assert.equal(state.tables.images.length, 1)
  }
})

test('failed usage checks stop deletion', async () => {
  const state = setup({ countErrors: ['generation_requests'] })
  state.tables.generations = []
  await assert.rejects(service.deleteUnusedImage(state.db, imageFixture()), /verify image usage/)
  assert.equal(state.storageCalls.length, 0)
})

test('database deletion failure never removes a storage file', async () => {
  const state = setup({ errors: { 'images:delete': true } })
  state.tables.generations = []
  await assert.rejects(service.deleteUnusedImage(state.db, imageFixture()), /storage file was retained/)
  assert.equal(state.storageCalls.length, 0)
})

test('storage errors, thrown failures, and empty removals restore metadata', async () => {
  for (const options of [{ storageError: true }, { storageThrow: true }, { emptyRemoval: true }]) {
    const state = setup(options)
    state.tables.generations = []
    await assert.rejects(service.deleteUnusedImage(state.db, imageFixture()), /metadata was restored/)
    assert.equal(state.tables.images[0].id, imageId)
    assert.deepEqual(state.events, ['images:delete', 'storage:remove', 'images:insert'])
  }
})

test('unused image deletion removes metadata before storage and confirms removal', async () => {
  const state = setup()
  state.tables.generations = []
  await service.deleteUnusedImage(state.db, imageFixture())
  assert.deepEqual(state.events, ['images:delete', 'storage:remove'])
  assert.equal(state.tables.images.length, 0)
})

test('all media actions reject signed-out or ordinary users', async () => {
  for (const options of [{ user: null }, { admin: false }]) {
    const state = setup(options)
    for (const invoke of [
      () => actions.createMedia(initialMutationState, form({ mode: 'upload-only', file: png() })),
      () => actions.updateSavedMedia(initialMutationState, form(savedFields())),
      () => actions.registerMediaImage(initialMutationState, form({ id })),
      () => actions.updateImageMetadata(initialMutationState, form({ id: imageId, updated_at: updatedAt })),
      () => actions.deleteMediaRecord('image', initialMutationState, form({ id: imageId, updated_at: updatedAt, confirm_delete: 'on' })),
    ]) assert.equal((await invoke()).status, 'error')
    assert.equal(state.events.length, 0)
  }
})

test('deletion confirmation and record-version checks cannot be bypassed', async () => {
  const state = setup()
  state.tables.generations = []
  assert.equal((await actions.deleteMediaRecord('image', initialMutationState, form({ id: imageId, updated_at: updatedAt }))).status, 'error')
  assert.equal((await actions.deleteMediaRecord('profiles', initialMutationState, form({ confirm_delete: 'on' }))).status, 'error')
  assert.equal((await actions.deleteMediaRecord('image', initialMutationState, form({ id: imageId, updated_at: '2026-10-25T00:00:00Z', confirm_delete: 'on' }))).status, 'error')
  assert.equal(state.events.length, 0)
})

test('image metadata edits cannot change storage identity', async () => {
  const state = setup()
  await assert.rejects(actions.updateImageMetadata(initialMutationState, form({ id: imageId, updated_at: updatedAt, original_filename: 'Renamed.png', alt_text: 'A photo', storage_path: 'forged' })), /REDIRECT:/)
  assert.equal(state.tables.images[0].storage_path, imageFixture().storage_path)
  assert.equal(state.tables.images[0].original_filename, 'Renamed.png')
  assert.equal(state.storageCalls.length, 0)
})

test('failed caption creation retains the registered upload for reuse', async () => {
  const state = setup({ errors: { 'generations:insert': true } })
  const result = await actions.createMedia(initialMutationState, form({ mode: 'saved-media', file: png(), caption: 'Caption' }))
  assert.match(result.message, /Uploaded images/)
  assert.equal(state.tables.images.length, 2)
  assert.equal(state.storageCalls.some(call => call.operation === 'remove'), false)
})

test('existing uploaded images can create a caption without a second upload', async () => {
  const state = setup()
  await assert.rejects(actions.createMedia(initialMutationState, form({ mode: 'saved-media', image_id: imageId, caption: 'Reuse' })), /REDIRECT:/)
  assert.equal(state.tables.generations.length, 2)
  assert.equal(state.storageCalls.length, 0)
})

test('null captions and whitespace are compared without destructive normalization', () => {
  const row = { ...mediaFixture(), caption: ' A caption ' }
  service.assertMediaUnchanged(row, row.image_url, row.caption)
  assert.throws(() => service.assertMediaUnchanged(row, row.image_url, 'A caption'), /changed/)
  service.assertMediaUnchanged({ ...row, caption: null }, row.image_url, '')
})

test('legacy registration records metadata without altering or re-uploading the original', async () => {
  const state = setup()
  state.tables.images = []
  let fetches = 0
  const image = await service.registerSavedImage(state.db, mediaFixture(), project, async url => {
    assert.equal(url, mediaFixture().image_url)
    fetches++
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
  })
  assert.equal(image.storage_path, imageFixture().storage_path)
  assert.equal(image.uploaded_by, actorId)
  assert.equal(image.size_bytes, 3)
  assert.equal(fetches, 1)
  assert.equal(state.storageCalls.length, 0)
  await service.registerSavedImage(state.db, mediaFixture(), project, () => { throw new Error('Must reuse metadata') })
  assert.equal(state.tables.images.length, 1)
})

test('external images are never fetched or removed by registration', async () => {
  const state = setup()
  const image = await service.registerSavedImage(state.db, { ...mediaFixture(), image_url: 'https://external.example/photo.png' }, project, () => { throw new Error('Must not fetch foreign origin') })
  assert.equal(image, null)
  assert.equal(state.events.length, 0)
})
