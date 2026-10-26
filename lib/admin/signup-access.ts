import { validateIdentity } from '@/lib/admin/catalog-validation'

export type SignupKind = 'domains' | 'emails'
export interface SignupEntry {
  id: string
  domain?: string
  email?: string
  note?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export const signupDefinitions = {
  domains: { table: 'allowed_signup_domains', field: 'domain', title: 'Allowed domains', noun: 'domain', select: 'id, domain, is_active, created_at, updated_at' },
  emails: { table: 'whitelisted_email_addresses', field: 'email', title: 'Whitelisted emails', noun: 'email address', select: 'id, email, note, is_active, created_at, updated_at' },
} as const

export function isSignupKind(value: unknown): value is SignupKind {
  return value === 'domains' || value === 'emails'
}

export function signupHref(kind: SignupKind, params?: Record<string, string>) {
  return `/admin/signup-access?${new URLSearchParams({ tab: kind, ...params })}`
}

export function validSignupDomain(value: string): boolean {
  // Match the existing database constraint; do not accept URLs, wildcards, or @.
  return value.length <= 253 && /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
}

export function validateSignupEntry(kind: SignupKind, form: FormData) {
  const identity = validateIdentity(form)
  const errors = { ...identity.errors }
  const field = signupDefinitions[kind].field
  const raw = form.get(field)
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  const values: Record<string, string | boolean | null> = { [field]: value, is_active: form.get('is_active') === 'on' }
  if (kind === 'domains') {
    if (!validSignupDomain(value)) errors.domain = 'Enter a bare domain such as columbia.edu, without @, a URL, or wildcards.'
  } else {
    const parts = value.split('@')
    const local = parts[0]
    if (value.length > 254 || parts.length !== 2 || !local || local.length > 64
      || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
      || local.startsWith('.') || local.endsWith('.') || local.includes('..')
      || !validSignupDomain(parts[1] ?? '')) errors.email = 'Enter a complete email address such as student@columbia.edu.'
    const rawNote = form.get('note')
    const note = typeof rawNote === 'string' ? rawNote.trim() : ''
    if ((rawNote !== null && typeof rawNote !== 'string') || note.length > 1000) errors.note = 'Use at most 1000 characters for the note.'
    values.note = note || null
  }
  return { ...identity, errors, values }
}

export function signupMutationError(error: { code?: string }, kind: SignupKind) {
  if (error.code === '23505') return `This ${signupDefinitions[kind].noun} is already in the list. Matching is case-insensitive.`
  if (error.code === '42501') return 'Your account does not have permission to change signup lists.'
  if (error.code === '23514') return `This ${signupDefinitions[kind].noun} does not match the database format. Check the value and try again.`
  return 'The change could not be saved. Reload the page and try again.'
}
