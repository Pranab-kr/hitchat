import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

// Seeds the owner row once. After that the DB is the only source of truth for admin
// identity, so OWNER_SECRET can be rotated without a redeploy — login never reads it.

const secret = process.env.OWNER_SECRET
if (!secret || secret.length < 12) {
  throw new Error('OWNER_SECRET must be set and at least 12 characters')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: readError } = await db
  .from('admins')
  .select('id')
  .eq('role', 'owner')
  .maybeSingle()

if (readError) throw readError

if (existing) {
  console.log('Owner already exists. Nothing to do.')
  process.exit(0)
}

const { error } = await db.from('admins').insert({
  display_name: 'Owner',
  role: 'owner',
  secret_hash: await bcrypt.hash(secret, 12),
})

if (error) throw error
console.log('Owner created.')
