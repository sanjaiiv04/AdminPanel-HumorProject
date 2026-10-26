import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Run with: node --test tests/admin-catalog.test.mjs (Node 22.18+).
// Execute the real Server Actions against an in-memory Supabase stub. No network
// requests or live database writes are made by this suite.
const providerId = '11111111-1111-4111-8111-111111111111'
const recordId = '22222222-2222-4222-8222-222222222222'
const updatedAt = '2026-10-26T12:00:00.123456+00:00'
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`
const cacheStub = moduleUrl('export function revalidatePath(...args) { globalThis.__adminCatalogTest.revalidated.push(args) }')
const navigationStub = moduleUrl('export function redirect(path) { throw new Error("REDIRECT:" + path) }')
const supabaseStub = moduleUrl('export async function createClient() { return globalThis.__adminCatalogTest.client }')
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks = { 'next/cache': cacheStub, 'next/navigation': navigationStub, 'server-only': moduleUrl(''), '@/lib/supabase/server': supabaseStub }
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true }
    if (specifier.startsWith('@/lib/admin/')) return { url: new URL(`../lib/admin/${specifier.split('/').at(-1)}.ts`, import.meta.url).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const actions = await import('../app/admin/catalog-actions.ts')
const contentActions = await import('../app/admin/content-actions.ts')
const signupActions = await import('../app/admin/signup-access/actions.ts')
const { validateProvider, validateModel, validateMix, initialMutationState } = await import('../lib/admin/catalog-validation.ts')
const { validateTerm, validateGenerationExample } = await import('../lib/admin/content-validation.ts')
const { validateSignupEntry, signupHref } = await import('../lib/admin/signup-access.ts')

function form(values) {
  const result = new FormData()
  for (const [key, value] of Object.entries(values)) if (value !== false) result.set(key, value === true ? 'on' : value)
  return result
}

function setup(overrides = {}) {
  const state = { user: { id: recordId }, admin: true, providerExists: true, missingReferences: [], databaseError: null, stale: false, writes: [], revalidated: [], ...overrides }
  state.client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from(table) {
      const query = { table, operation: 'select', filters: [], values: null }
      const builder = {
        select() { return builder },
        eq(column, value) { query.filters.push([column, value]); return builder },
        update(values) { query.operation = 'update'; query.values = values; return builder },
        insert(values) { query.operation = 'insert'; query.values = values; return builder },
        delete() { query.operation = 'delete'; return builder },
        async single() { return { data: { is_superadmin: state.admin }, error: null } },
        async maybeSingle() {
          if (query.operation === 'select') return { data: state.providerExists && !state.missingReferences.includes(table) ? { id: providerId } : null, error: null }
          state.writes.push(query)
          return { data: state.stale || state.databaseError ? null : { id: recordId }, error: state.databaseError }
        },
      }
      return builder
    },
  }
  globalThis.__adminCatalogTest = state
  return state
}

const providerForm = extra => form({ name: '  Google Gemini  ', slug: 'google', is_active: true, ...extra })
const modelForm = extra => form({ name: 'Caption model', provider_id: providerId, model_identifier: 'gemini-test', supports_images: true, is_active: true, ...extra })
const identity = { id: recordId, updated_at: updatedAt }

test('validates provider identifiers and trims names', () => {
  assert.equal(validateProvider(providerForm()).values.name, 'Google Gemini')
  assert.ok(validateProvider(providerForm({ slug: 'Google' })).errors.slug)
  assert.ok(validateProvider(providerForm({ name: '' })).errors.name)
})

test('rejects invalid provider references and whitespace in model identifiers', () => {
  assert.ok(validateModel(modelForm({ provider_id: 'wrong' })).errors.provider_id)
  assert.ok(validateModel(modelForm({ model_identifier: 'bad model' })).errors.model_identifier)
  assert.deepEqual(validateModel(modelForm()).errors, {})
})

test('mix weights match database precision and reject non-finite or rounded input', () => {
  for (const weight of ['0.000001', '1', '2.500000', '999999.999999']) assert.deepEqual(validateMix(form({ ...identity, weight })).errors, {})
  for (const weight of ['0', '-1', 'NaN', 'Infinity', '1e3', '0.0000001', '1000000', '1.1234567']) assert.ok(validateMix(form({ ...identity, weight })).errors.weight, weight)
  assert.ok(validateMix(form({ id: recordId, weight: '1' })).errors.updated_at)
})

test('all mutation entry points reject signed-out and non-admin callers', async () => {
  for (const overrides of [{ user: null }, { admin: false }]) {
    const state = setup(overrides)
    for (const call of [
      () => actions.saveProvider(initialMutationState, providerForm()),
      () => actions.saveModel(initialMutationState, modelForm()),
      () => actions.deleteCatalogRecord('providers', initialMutationState, form({ ...identity, confirm_delete: true })),
      () => actions.updateChainMix(initialMutationState, form({ ...identity, weight: '1' })),
    ]) assert.equal((await call()).status, 'error')
    assert.equal(state.writes.length, 0)
  }
})

test('provider creation writes only allowed fields and revalidates before redirect', async () => {
  const state = setup()
  await assert.rejects(actions.saveProvider(initialMutationState, providerForm({ is_superadmin: true, arbitrary: 'ignored' })), /REDIRECT:\/admin\/models-providers\?tab=providers&saved=1/)
  assert.deepEqual(state.writes[0].values, { name: 'Google Gemini', slug: 'google', is_active: true })
  assert.deepEqual(state.revalidated, [['/admin', 'layout']])
})

test('model creation checks that its provider still exists', async () => {
  const state = setup({ providerExists: false })
  const result = await actions.saveModel(initialMutationState, modelForm())
  assert.ok(result.errors.provider_id)
  assert.equal(state.writes.length, 0)
})

test('model edits use the original timestamp and preserve unchecked flags', async () => {
  const state = setup()
  await assert.rejects(actions.saveModel(initialMutationState, modelForm({ ...identity, is_active: false, supports_images: false })), /REDIRECT:/)
  assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  assert.equal(state.writes[0].values.is_active, false)
  assert.equal(state.writes[0].values.supports_images, false)
})

test('concurrent edits and missing records return a conflict instead of false success', async () => {
  const state = setup({ stale: true })
  const result = await actions.saveProvider(initialMutationState, providerForm(identity))
  assert.match(result.message, /changed or was removed/)
  assert.equal(state.revalidated.length, 0)
})

test('duplicate identifiers and referenced records return useful errors', async () => {
  setup({ databaseError: { code: '23505' } })
  assert.match((await actions.saveProvider(initialMutationState, providerForm())).message, /slug already exists/)
  setup({ databaseError: { code: '23503' } })
  assert.match((await actions.deleteCatalogRecord('models', initialMutationState, form({ ...identity, confirm_delete: true }))).message, /prompt chain steps/)
})

test('deletions require confirmation and an unmodified record timestamp', async () => {
  const state = setup()
  assert.equal((await actions.deleteCatalogRecord('providers', initialMutationState, form(identity))).status, 'error')
  assert.equal(state.writes.length, 0)
  await assert.rejects(actions.deleteCatalogRecord('providers', initialMutationState, form({ ...identity, confirm_delete: true })), /REDIRECT:\/admin\/models-providers\?tab=providers&deleted=1/)
  assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  assert.equal(state.writes[0].operation, 'delete')
})

test('forged catalog kinds cannot select arbitrary tables', async () => {
  const state = setup()
  assert.equal((await actions.deleteCatalogRecord('profiles', initialMutationState, form({ ...identity, confirm_delete: true }))).status, 'error')
  assert.equal(state.writes.length, 0)
})

test('mix updates cannot change the chain reference or bypass precision validation', async () => {
  const state = setup()
  assert.equal((await actions.updateChainMix(initialMutationState, form({ ...identity, weight: 'NaN' }))).status, 'error')
  assert.equal(state.writes.length, 0)
  await assert.rejects(actions.updateChainMix(initialMutationState, form({ ...identity, weight: '2.5', is_enabled: true, prompt_chain_id: providerId })), /REDIRECT:/)
  assert.deepEqual(state.writes[0].values, { weight: '2.5', is_enabled: true })
})

const termForm = extra => form({ term: '  Office hours  ', definition: '  A time to meet the instructor.  ', example: '', is_active: true, ...extra })
const exampleForm = extra => form({ caption: 'A caption to follow.', context: '', sentiment: 'positive', prompt_chain_id: '', image_id: '', is_active: true, ...extra })

test('terms trim required content, preserve optional nulls, and enforce length limits', () => {
  const valid = validateTerm(termForm())
  assert.deepEqual(valid.values, { term: 'Office hours', definition: 'A time to meet the instructor.', example: null, is_active: true })
  assert.ok(validateTerm(termForm({ term: '   ' })).errors.term)
  assert.ok(validateTerm(termForm({ definition: '' })).errors.definition)
  assert.ok(validateTerm(termForm({ example: 'x'.repeat(2001) })).errors.example)
})

test('example validation accepts global/text-only scope and rejects invalid relations or sentiment', () => {
  const valid = validateGenerationExample(exampleForm())
  assert.deepEqual(valid.errors, {})
  assert.equal(valid.values.prompt_chain_id, null)
  assert.equal(valid.values.image_id, null)
  assert.equal(valid.values.context, null)
  for (const [key, value] of [['caption', ''], ['sentiment', 'neutral'], ['prompt_chain_id', 'wrong'], ['image_id', 'wrong'], ['context', 'x'.repeat(4001)]]) {
    assert.ok(validateGenerationExample(exampleForm({ [key]: value })).errors[key], key)
  }
})

test('content actions all require a signed-in superadmin', async () => {
  for (const overrides of [{ user: null }, { admin: false }]) {
    const state = setup(overrides)
    for (const call of [
      () => contentActions.saveTerm(initialMutationState, termForm()),
      () => contentActions.saveGenerationExample(initialMutationState, exampleForm()),
      () => contentActions.deleteContentRecord('terms', initialMutationState, form({ ...identity, confirm_delete: true })),
      () => contentActions.deleteContentRecord('generation-examples', initialMutationState, form({ ...identity, confirm_delete: true })),
    ]) assert.equal((await call()).status, 'error')
    assert.equal(state.writes.length, 0)
  }
})

test('term writes use allowed columns and report case-insensitive duplicate conflicts', async () => {
  const state = setup()
  await assert.rejects(contentActions.saveTerm(initialMutationState, termForm({ arbitrary: 'ignored' })), /REDIRECT:\/admin\/terms\?saved=1/)
  assert.equal(state.writes[0].table, 'terms')
  assert.equal(state.writes[0].values.arbitrary, undefined)
  setup({ databaseError: { code: '23505' } })
  assert.match((await contentActions.saveTerm(initialMutationState, termForm())).message, /regardless of letter case/)
})

test('example writes reject removed chains or images before saving', async () => {
  for (const [table, field] of [['prompt_chains', 'prompt_chain_id'], ['images', 'image_id']]) {
    const state = setup({ missingReferences: [table] })
    const result = await contentActions.saveGenerationExample(initialMutationState, exampleForm({ [field]: providerId }))
    assert.ok(result.errors[field])
    assert.equal(state.writes.length, 0)
  }
})

test('example updates clear optional references and protect newer edits', async () => {
  const state = setup()
  await assert.rejects(contentActions.saveGenerationExample(initialMutationState, exampleForm({ ...identity, is_active: false, sentiment: 'negative', arbitrary: 'ignored' })), /REDIRECT:/)
  assert.equal(state.writes[0].table, 'ai_generation_examples')
  assert.equal(state.writes[0].values.prompt_chain_id, null)
  assert.equal(state.writes[0].values.image_id, null)
  assert.equal(state.writes[0].values.is_active, false)
  assert.equal(state.writes[0].values.sentiment, 'negative')
  assert.equal(state.writes[0].values.arbitrary, undefined)
  assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  setup({ stale: true })
  assert.match((await contentActions.saveGenerationExample(initialMutationState, exampleForm(identity))).message, /changed or was removed/)
})

test('content deletions require confirmation and only delete the chosen content row', async () => {
  for (const [kind, table] of [['terms', 'terms'], ['generation-examples', 'ai_generation_examples']]) {
    const state = setup()
    assert.equal((await contentActions.deleteContentRecord(kind, initialMutationState, form(identity))).status, 'error')
    assert.equal(state.writes.length, 0)
    await assert.rejects(contentActions.deleteContentRecord(kind, initialMutationState, form({ ...identity, confirm_delete: true })), /REDIRECT:/)
    assert.equal(state.writes.length, 1)
    assert.equal(state.writes[0].operation, 'delete')
    assert.equal(state.writes[0].table, table)
    assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  }
})

test('content actions reject invalid payloads and forged table names without writing', async () => {
  const state = setup()
  assert.equal((await contentActions.saveTerm(initialMutationState, termForm({ term: '' }))).status, 'error')
  assert.equal((await contentActions.saveGenerationExample(initialMutationState, exampleForm({ sentiment: 'neutral' }))).status, 'error')
  assert.equal((await contentActions.deleteContentRecord('profiles', initialMutationState, form({ ...identity, confirm_delete: true }))).status, 'error')
  assert.equal(state.writes.length, 0)
})

test('concurrent linked-record removal returns a recoverable example error', async () => {
  setup({ databaseError: { code: '23503' } })
  const result = await contentActions.saveGenerationExample(initialMutationState, exampleForm({ prompt_chain_id: providerId }))
  assert.match(result.message, /linked chain or image changed/)
})

const domainForm = extra => form({ domain: '  Columbia.EDU  ', is_active: true, ...extra })
const emailForm = extra => form({ email: '  Student+Class@Columbia.EDU  ', note: '', is_active: true, ...extra })

test('signup domains normalize case while preserving exact subdomain scope', () => {
  assert.deepEqual(validateSignupEntry('domains', domainForm()).values, { domain: 'columbia.edu', is_active: true })
  assert.equal(validateSignupEntry('domains', domainForm({ domain: 'cs.Columbia.edu' })).values.domain, 'cs.columbia.edu')
  for (const domain of ['https://columbia.edu', '@columbia.edu', '*.columbia.edu', 'student@columbia.edu', 'localhost', 'columbia.edu/path', 'columbia.edu.', '-bad.edu', 'bad-.edu', `${'a'.repeat(64)}.edu`, 'a'.repeat(254)]) {
    assert.ok(validateSignupEntry('domains', domainForm({ domain })).errors.domain, domain)
  }
})

test('whitelisted email normalization preserves plus addressing and clears optional notes', () => {
  assert.deepEqual(validateSignupEntry('emails', emailForm()).values, { email: 'student+class@columbia.edu', is_active: true, note: null })
  assert.equal(validateSignupEntry('emails', emailForm({ note: '  Approved for a course  ' })).values.note, 'Approved for a course')
  assert.equal(validateSignupEntry('emails', emailForm({ is_active: false })).values.is_active, false)
})

test('email validation rejects malformed addresses and overlong values', () => {
  for (const email of ['not-an-email', '@columbia.edu', 'student@', 'a@@columbia.edu', '.student@columbia.edu', 'student.@columbia.edu', 'a..b@columbia.edu', 'a b@columbia.edu', 'Student <student@columbia.edu>', 'student@localhost', `${'a'.repeat(65)}@columbia.edu`]) {
    assert.ok(validateSignupEntry('emails', emailForm({ email })).errors.email, email)
  }
  assert.ok(validateSignupEntry('emails', emailForm({ note: 'x'.repeat(1001) })).errors.note)
})

test('signup hrefs keep tab selection while encoding pagination and notices', () => {
  assert.equal(signupHref('emails', { page: '2' }), '/admin/signup-access?tab=emails&page=2')
  assert.equal(signupHref('domains', { saved: '1' }), '/admin/signup-access?tab=domains&saved=1')
})

test('every signup mutation requires superadmin authorization', async () => {
  for (const overrides of [{ user: null }, { admin: false }]) {
    const state = setup(overrides)
    for (const kind of ['domains', 'emails']) {
      assert.equal((await signupActions.saveSignupEntry(kind, initialMutationState, kind === 'domains' ? domainForm() : emailForm())).status, 'error')
      assert.equal((await signupActions.deleteSignupEntry(kind, initialMutationState, form({ ...identity, confirm_delete: true }))).status, 'error')
    }
    assert.equal(state.writes.length, 0)
  }
})

test('signup creation writes only normalized list fields to the correct table', async () => {
  for (const [kind, table, fields] of [['domains', 'allowed_signup_domains', domainForm({ email: 'ignored@example.edu', is_superadmin: true })], ['emails', 'whitelisted_email_addresses', emailForm({ domain: 'ignored.edu', is_superadmin: true })]]) {
    const state = setup()
    await assert.rejects(signupActions.saveSignupEntry(kind, initialMutationState, fields), new RegExp(`REDIRECT:/admin/signup-access\\?tab=${kind}&saved=1`))
    assert.equal(state.writes[0].table, table)
    assert.equal(state.writes[0].values.is_superadmin, undefined)
    assert.equal(state.writes[0].values[kind === 'domains' ? 'domain' : 'email'], kind === 'domains' ? 'columbia.edu' : 'student+class@columbia.edu')
    assert.equal(state.writes[0].values[kind === 'domains' ? 'email' : 'domain'], undefined)
  }
})

test('duplicate signup entries and database validation errors are recoverable', async () => {
  for (const kind of ['domains', 'emails']) {
    setup({ databaseError: { code: '23505' } })
    const result = await signupActions.saveSignupEntry(kind, initialMutationState, kind === 'domains' ? domainForm() : emailForm())
    assert.match(result.message, /already in the list/)
  }
  setup({ databaseError: { code: '23514' } })
  assert.match((await signupActions.saveSignupEntry('domains', initialMutationState, domainForm())).message, /database format/)
})

test('signup edits and deletions protect the original record version', async () => {
  const state = setup()
  await assert.rejects(signupActions.saveSignupEntry('emails', initialMutationState, emailForm({ ...identity, is_active: false })), /REDIRECT:/)
  assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  assert.equal(state.writes[0].values.is_active, false)
  setup({ stale: true })
  assert.match((await signupActions.saveSignupEntry('domains', initialMutationState, domainForm(identity))).message, /changed or was removed/)
  assert.match((await signupActions.deleteSignupEntry('emails', initialMutationState, form({ ...identity, confirm_delete: true }))).message, /changed or was removed/)
})

test('signup deletions require confirmation and never delete user accounts', async () => {
  for (const [kind, table] of [['domains', 'allowed_signup_domains'], ['emails', 'whitelisted_email_addresses']]) {
    const state = setup()
    assert.equal((await signupActions.deleteSignupEntry(kind, initialMutationState, form(identity))).status, 'error')
    assert.equal(state.writes.length, 0)
    await assert.rejects(signupActions.deleteSignupEntry(kind, initialMutationState, form({ ...identity, confirm_delete: true })), /REDIRECT:/)
    assert.equal(state.writes.length, 1)
    assert.equal(state.writes[0].table, table)
    assert.equal(state.writes[0].operation, 'delete')
    assert.deepEqual(state.writes[0].filters, [['id', recordId], ['updated_at', updatedAt]])
  }
})

test('forged signup kinds, invalid entries, and malformed identities cannot write', async () => {
  const state = setup()
  assert.equal((await signupActions.saveSignupEntry('profiles', initialMutationState, domainForm())).status, 'error')
  assert.equal((await signupActions.deleteSignupEntry('profiles', initialMutationState, form({ ...identity, confirm_delete: true }))).status, 'error')
  assert.equal((await signupActions.saveSignupEntry('domains', initialMutationState, domainForm({ domain: '*.edu' }))).status, 'error')
  assert.equal((await signupActions.saveSignupEntry('emails', initialMutationState, emailForm({ email: '' }))).status, 'error')
  assert.equal((await signupActions.deleteSignupEntry('domains', initialMutationState, form({ id: 'wrong', confirm_delete: true }))).status, 'error')
  assert.equal(state.writes.length, 0)
})
