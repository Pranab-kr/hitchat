import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/supabase/admin'
import { OwnerShell } from '@/components/admin/owner-shell'
import { StructureForms, type DeptNode } from '@/components/admin/structure-forms'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Structure',
  robots: { index: false, follow: false },
}

export default async function StructurePage() {
  // This page re-verifies its own session. proxy.ts is not authorization, and every
  // action behind these forms calls requireOwner() again regardless of what happens
  // here — this check only decides whether the page renders at all.
  const session = await verifySession()
  if (!session) redirect('/sudo')
  if (session.role !== 'owner') redirect('/')

  const db = getServiceClient()
  const { data } = await db
    .from('departments')
    .select('id, name, slug, years(id, number, batches(id, number, groups(id, label)))')
    .order('sort_order')

  const departments = (data ?? []) as unknown as DeptNode[]
  const sorted = departments.map((d) => ({
    ...d,
    years: [...(d.years ?? [])]
      .sort((a, b) => a.number - b.number)
      .map((y) => ({
        ...y,
        batches: [...(y.batches ?? [])].sort((a, b) => a.number - b.number),
      })),
  }))

  return (
    <OwnerShell title="Structure" sub="Departments, years, batches and groups.">
      <StructureForms departments={sorted} />

      <section className="mt-10">
        <h2 className="mb-3 text-[17px] leading-6 font-semibold text-ink">
          Current rooms
        </h2>

        {sorted.length === 0 ? (
          <p className="text-[15px] leading-6 text-graphite">
            Nothing yet. Create a department to begin.
          </p>
        ) : (
          <div className="space-y-4">
            {sorted.map((dept) => (
              <div
                key={dept.id}
                className="rounded-card border border-hairline bg-surface px-5 py-4"
              >
                <h3 className="text-[15px] leading-6 font-semibold text-ink">
                  {dept.name}{' '}
                  <span className="font-mono text-[12px] font-normal text-graphite">
                    /{dept.slug}
                  </span>
                </h3>

                {dept.years.length === 0 ? (
                  <p className="mt-1 font-mono text-[12px] leading-4 text-graphite">
                    no years yet
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {dept.years.map((year) => (
                      <li
                        key={year.id}
                        className="font-mono text-[12px] leading-5 text-graphite"
                      >
                        year {year.number} —{' '}
                        {year.batches.length === 0
                          ? 'no batches'
                          : year.batches
                              .map(
                                (b) =>
                                  `batch ${b.number} (${
                                    (b.groups ?? []).length === 0
                                      ? 'no groups'
                                      : [...b.groups]
                                          .sort((x, y2) => x.label.localeCompare(y2.label))
                                          .map((g) => g.label)
                                          .join(', ')
                                  })`,
                              )
                              .join(' · ')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </OwnerShell>
  )
}
