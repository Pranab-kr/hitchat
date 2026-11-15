import type { Metadata } from 'next'
import { verifySession } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/supabase/admin'
import { SudoForm } from '@/components/admin/sudo-form'
import { OwnerShell } from '@/components/admin/owner-shell'
import { StructureForms } from '@/components/admin/structure-forms'
import { SudoRooms } from '@/components/admin/sudo-rooms'

export const dynamic = 'force-dynamic'

type DeptNode = {
  id: string
  name: string
  slug: string
  years: {
    id: string
    number: number
    batches: {
      id: string
      number: number
      groups: {
        id: string
        label: string
        created_by_admin_id: string | null
        created_by_hash: string | null
      }[]
    }[]
  }[]
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await verifySession()
  return { title: session ? 'Structure' : 'Sign in', robots: { index: false, follow: false } }
}

export default async function SudoPage() {
  const session = await verifySession()

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[380px] flex-col justify-center px-6">
        <div className="rise rounded-card border border-hairline bg-surface px-6 py-7">
          <h1 className="font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">Sign in</h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">Admins only.</p>
          <SudoForm />
        </div>
      </main>
    )
  }

  const db = getServiceClient()
  const { data } = await db
    .from('departments')
    .select('id, name, slug, years(id, number, batches(id, number, groups(id, label, created_by_admin_id, created_by_hash)))')
    .order('sort_order')

  const departments = (data ?? []) as unknown as DeptNode[]
  const sorted = departments.map((d) => ({
    ...d,
    years: [...(d.years ?? [])]
      .sort((a, b) => a.number - b.number)
      .map((y) => ({ ...y, batches: [...(y.batches ?? [])].sort((a, b) => a.number - b.number) })),
  }))
  const roomDepartments = sorted.map((department) => ({
    ...department,
    years: department.years.map((year) => ({
      ...year,
      batches: year.batches.map((batch) => ({
        ...batch,
        groups: batch.groups.map((group) => ({
          id: group.id,
          label: group.label,
          createdByAdminId: group.created_by_admin_id,
          creatorIsAnon: group.created_by_hash !== null,
        })),
      })),
    })),
  }))
  const hasRooms = roomDepartments.some((department) =>
    department.years.some((year) => year.batches.some((batch) => batch.groups.length > 0)),
  )

  return (
    <OwnerShell title="Structure" sub="Add and remove rooms." role={session.role}>
      <StructureForms departments={sorted} canDelete={session.role === 'owner'} />
      <section className="mt-12">
        <h2 className="mb-4 text-[20px] leading-7 font-semibold text-ink">Current rooms</h2>
        {!hasRooms ? (
          <p className="text-[15px] leading-6 text-graphite">No rooms yet.</p>
        ) : (
          <SudoRooms departments={roomDepartments} session={session} />
        )}
      </section>
    </OwnerShell>
  )
}
