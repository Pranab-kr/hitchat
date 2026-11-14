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
        <div className="rounded-card border border-hairline bg-surface px-6 py-6">
          <h1 className="text-[20px] leading-7 font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">Admin access. Students never need this page.</p>
          <SudoForm />
        </div>
        <p className="mt-4 px-1 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">Sessions last 3 hours.</p>
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

  return (
    <OwnerShell title="Structure" sub="Departments, years, batches and groups." role={session.role}>
      <StructureForms departments={sorted} canDelete={session.role === 'owner'} />
      <section className="mt-10">
        <h2 className="mb-3 text-[17px] leading-6 font-semibold text-ink">Current rooms</h2>
        {sorted.length === 0 ? (
          <p className="text-[15px] leading-6 text-graphite">Nothing yet. Create a department to begin.</p>
        ) : (
          <SudoRooms departments={roomDepartments} session={session} />
        )}
      </section>
    </OwnerShell>
  )
}
