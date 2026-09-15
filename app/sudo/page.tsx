import type { Metadata } from 'next'
import { verifySession } from '@/lib/auth/session'
import { getServiceClient } from '@/lib/supabase/admin'
import { SudoForm } from '@/components/admin/sudo-form'
import { OwnerShell } from '@/components/admin/owner-shell'
import { StructureForms, type DeptNode } from '@/components/admin/structure-forms'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const session = await verifySession()
  return {
    title: session ? 'Structure' : 'Sign in',
    robots: { index: false, follow: false },
  }
}

export default async function SudoPage() {
  const session = await verifySession()

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[380px] flex-col justify-center px-6">
        {/* No marigold anywhere on this page. It signals "an admin is present" and nobody
            is authenticated yet; spending it here would blunt the badge in the stream. */}
        <div className="rounded-card border border-hairline bg-surface px-6 py-6">
          <h1 className="text-[20px] leading-7 font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">
            Admin access. Students never need this page.
          </p>

          <SudoForm />
        </div>

        <p className="mt-4 px-1 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
          Sessions last 3 hours.
        </p>
      </main>
    )
  }

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
    <OwnerShell
      title="Structure"
      sub="Departments, years, batches and groups."
      role={session.role}
    >
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
