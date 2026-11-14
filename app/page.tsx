import type { Metadata } from 'next'
import { getRoomTree } from '@/lib/room-tree'
import { ordinal } from '@/lib/rooms'
import { RoomLink } from '@/components/room/room-link'
import { CreateForms } from '@/components/room/create-forms'

// The room tree changes whenever the owner edits it, and the list is tiny. Rendering
// per request keeps a newly created room from being invisible behind a cached page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'hitchat',
  description: 'Anonymous lab chat. Everything vanishes in 8 hours.',
}

export default async function HomePage() {
  // The picker renders the pruned tree from lib/room-tree.ts. Room creation accepts the
  // hierarchy as typed values, so it does not need a second structure read or dropdowns.
  const departments = await getRoomTree()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">
          hitchat
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-graphite">
          Pick your room. Everything posted here vanishes in 8 hours.
        </p>
      </div>

      {/* Collapsed by default: most visitors come here to open a room, not to build one. */}
      <details className="mb-8 rounded-card border border-hairline bg-surface">
        <summary className="cursor-pointer list-none px-5 py-4 text-[15px] leading-6 font-medium text-ink">
          New room{' '}
          <span className="font-mono text-[12px] leading-4 font-normal text-graphite">
            department → year → batch → room
          </span>
        </summary>
        <div className="border-t border-hairline px-5 py-5">
          <CreateForms />
        </div>
      </details>

      {departments.length === 0 ? (
        <p className="text-[15px] leading-6 text-graphite">
          No rooms yet. Open New room to create the first one.
        </p>
      ) : (
        <div className="space-y-8">
          {departments.map((dept) => (
            <section key={dept.id}>
              <h2 className="mb-3 text-[20px] leading-7 font-semibold text-ink">
                {dept.name}
              </h2>

              {dept.years.map((year) => (
                <div key={year.number} className="mb-4 last:mb-0">
                  <h3 className="mb-2 font-mono text-[12px] leading-4 tracking-[0.08em] text-graphite uppercase">
                    {ordinal(year.number)} year
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {year.batches.flatMap((batch) =>
                      batch.groups.map((group) => (
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

      <div className="mt-12">
        <p className="font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
          No sign-up. No names. Messages delete themselves after 8 hours.
        </p>
      </div>
    </main>
  )
}
