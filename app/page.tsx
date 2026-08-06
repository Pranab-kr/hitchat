import type { Metadata } from 'next'
import { getServiceClient } from '@/lib/supabase/admin'
import { ThemeToggle } from '@/components/theme-toggle'
import { RoomLink } from '@/components/room/room-link'

// The room tree changes whenever the owner edits it, and the list is tiny. Rendering
// per request keeps a newly created room from being invisible behind a cached page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'hitchat',
  description: 'Anonymous lab chat. Everything vanishes in 8 hours.',
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th']
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`

type GroupRow = { label: string }
type BatchRow = { number: number; groups: GroupRow[] }
type YearRow = { number: number; batches: BatchRow[] }
type DeptRow = { id: string; name: string; slug: string; years: YearRow[] }

export default async function HomePage() {
  const db = getServiceClient()
  const { data } = await db
    .from('departments')
    .select('id, name, slug, years(number, batches(number, groups(label)))')
    .order('sort_order')

  // PostgREST types nested selects loosely; the shape is asserted once here rather than
  // with an `any` cast at each use site.
  const departments = (data ?? []) as unknown as DeptRow[]

  // A department with no rooms under it yet is noise on a picker — the owner sees it on
  // /sudo/structure, where it can be acted on.
  const populated = departments.filter((d) =>
    (d.years ?? []).some((y) => (y.batches ?? []).some((b) => (b.groups ?? []).length > 0)),
  )

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">
            hitchat
          </h1>
          <p className="mt-1 text-[15px] leading-6 text-graphite">
            Pick your room. Everything posted here vanishes in 8 hours.
          </p>
        </div>
        <ThemeToggle />
      </div>

      {populated.length === 0 ? (
        <p className="text-[15px] leading-6 text-graphite">
          No rooms yet. An admin needs to create one first.
        </p>
      ) : (
        <div className="space-y-8">
          {populated.map((dept) => (
            <section key={dept.id}>
              <h2 className="mb-3 text-[20px] leading-7 font-semibold text-ink">
                {dept.name}
              </h2>

              {[...(dept.years ?? [])]
                .sort((a, b) => a.number - b.number)
                .filter((y) => (y.batches ?? []).some((b) => (b.groups ?? []).length > 0))
                .map((year) => (
                  <div key={year.number} className="mb-4 last:mb-0">
                    <h3 className="mb-2 font-mono text-[12px] leading-4 tracking-[0.08em] text-graphite uppercase">
                      {ordinal(year.number)} year
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {[...(year.batches ?? [])]
                        .sort((a, b) => a.number - b.number)
                        .flatMap((batch) =>
                          [...(batch.groups ?? [])]
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((group) => (
                              <RoomLink
                                key={`${batch.number}-${group.label}`}
                                href={`/c/${dept.slug}/${year.number}/${batch.number}/${group.label.toLowerCase()}`}
                              >
                                Batch {batch.number} · {group.label}
                              </RoomLink>
                            )),
                        )}
                    </div>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
        No sign-up. No names. Messages delete themselves after 8 hours.
      </p>
    </main>
  )
}
