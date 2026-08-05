import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/supabase/admin'
import { OwnerShell } from '@/components/admin/owner-shell'
import { AdminsPanel } from '@/components/admin/admins-panel'
import type { AdminSummary } from '@/lib/owner-forms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admins',
  robots: { index: false, follow: false },
}

export default async function AdminsPage() {
  // Re-verified here, and again inside every action this page can reach.
  const session = await verifySession()
  if (!session) redirect('/sudo')
  if (session.role !== 'owner') redirect('/')

  const db = getServiceClient()
  // secret_hash is deliberately not selected. Nothing on this page, or behind it, ever
  // reads a secret back out.
  const { data } = await db
    .from('admins')
    .select('id, display_name, role, created_at, revoked_at')
    .order('created_at', { ascending: true })

  const admins: AdminSummary[] = (data ?? []).map((a) => ({
    id: a.id,
    displayName: a.display_name,
    role: a.role as 'owner' | 'co_admin',
    createdAt: a.created_at,
    revokedAt: a.revoked_at,
  }))

  return (
    <OwnerShell title="Admins" sub="Who can moderate, and who used to.">
      <AdminsPanel admins={admins} />
    </OwnerShell>
  )
}
