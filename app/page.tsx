import type { Metadata } from 'next'
import { getRoomTree } from '@/lib/room-tree'
import { ordinal } from '@/lib/rooms'
import { ThemeToggle } from '@/components/theme-toggle'
import { RoomLink } from '@/components/room/room-link'

// The room tree changes whenever the owner edits it, and the list is tiny. Rendering
// per request keeps a newly created room from being invisible behind a cached page.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'hitchat',
  description: 'Anonymous lab chat. Everything vanishes in 8 hours.',
}

export default async function HomePage() {
  // Shared with the in-room sidebar (lib/room-tree.ts): already pruned to populated
  // rooms and fully sorted, so this page just renders it.
  const departments = await getRoomTree()

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

      {departments.length === 0 ? (
        <p className="text-[15px] leading-6 text-graphite">
          No rooms yet. An admin needs to create one first.
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

      <p className="mt-12 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
        No sign-up. No names. Messages delete themselves after 8 hours.
      </p>
    </main>
  )
}
