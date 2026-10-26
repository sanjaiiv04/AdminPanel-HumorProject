import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function authorizedAdminContext() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Sign in with a superadmin account to continue.')
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('is_superadmin').eq('id', user.id).single()
  if (profileError || !profile?.is_superadmin) throw new Error('Superadmin access is required.')
  return { supabase, user }
}

export async function authorizedAdminClient() {
  return (await authorizedAdminContext()).supabase
}
