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
    <main className="mx-auto max-w-2xl px-6 pt-10 pb-24">
      {/* The 8-hour promise is said once, here, under the name. */}
      <div className="rise mb-12">
        <h1 className="font-display text-[44px] leading-[48px] font-semibold tracking-[-0.03em] text-ink">
          hitchat
        </h1>
        <p className="mt-2 text-[17px] leading-7 text-pretty text-graphite">
          Anonymous lab chat. Messages vanish in 8 hours.
        </p>
      </div>

      {departments.length === 0 ? (
        <p className="rise text-[15px] leading-6 text-graphite" style={{ '--i': 1 } as React.CSSProperties}>
          No rooms yet. Add the first one below.
        </p>
      ) : (
        <div className="space-y-10">
          {departments.map((dept, d) => (
            <section
              key={dept.id}
              className="rise"
              style={{ '--i': d + 1 } as React.CSSProperties}
            >
              <h2 className="mb-4 text-[20px] leading-7 font-semibold text-ink">{dept.name}</h2>

              <div className="space-y-4">
                {dept.years.map((year) => (
                  <div key={year.number} className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <h3 className="w-20 shrink-0 pt-2 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
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
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Collapsed by default: most visitors come here to open a room, not to build one. */}
      <details
        className="smooth group rise mt-12 border-t border-hairline pt-6"
        style={{ '--i': departments.length + 2 } as React.CSSProperties}
      >
        <summary className="press flex w-fit cursor-pointer list-none items-center gap-2 rounded-input py-1 pr-3 text-[14px] leading-5 font-medium text-graphite hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden
            className="transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-open:rotate-45"
          >
            <path
              d="M8 3v10M3 8h10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Add a room
        </summary>
        <div className="pt-5">
          <CreateForms bare />
        </div>
      </details>
    </main>
  )
}
