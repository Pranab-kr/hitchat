import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

// Rotates the owner's secret to the current OWNER_SECRET, and kills every live admin
// session. Use this when the old secret has leaked; seed-owner.ts deliberately will not
// do it (it is idempotent and refuses to touch an existing owner).
//
//   1. put the NEW secret in .env.local as OWNER_SECRET
//   2. bun run rotate-owner
//
// Login reads the bcrypt hash from the database, never the env var, so no redeploy is
// needed for the new secret to take effect.

const secret = process.env.OWNER_SECRET
if (!secret || secret.length < 16) {
  throw new Error('OWNER_SECRET must be set and at least 16 characters')
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: owner, error: readError } = await db
  .from('admins')
  .select('id, secret_hash')
  .eq('role', 'owner')
  .maybeSingle()

if (readError) throw readError
if (!owner) {
  throw new Error('No owner row exists. Run scripts/seed-owner.ts first.')
}

// Refuse a no-op rotation: if the env var still holds the leaked value, silently
// "succeeding" would leave the leaked secret live and look like it had been replaced.
if (await bcrypt.compare(secret, owner.secret_hash)) {
  throw new Error(
    'OWNER_SECRET matches the secret already in the database — nothing was rotated. ' +
      'Put the NEW secret in .env.local first.',
  )
}

const { error: updateError } = await db
  .from('admins')
  .update({ secret_hash: await bcrypt.hash(secret, 12) })
  .eq('id', owner.id)

if (updateError) throw updateError

// A leaked secret may already have minted sessions. Those cookies stay valid for 7 days
// on their own, so rotating without clearing them leaves the door open.
const { error: sessionError } = await db
  .from('admin_sessions')
  .delete()
  .eq('admin_id', owner.id)

if (sessionError) throw sessionError

console.log('Owner secret rotated. All owner sessions were signed out.')
