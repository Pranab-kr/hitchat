import type { Message } from './types'

// The lab-tag filter, kept as pure functions so the stream component stays declarative
// and the behavior is unit-tested rather than asserted by comment. Spec §"Lab tag
// filter": chips are built from the tags currently present, and selecting one "filters
// the stream to code posts with that tag", purely client-side.

// A lab chip narrows the stream to posts carrying that exact tag. With no lab selected
// everything shows. Text messages have no `lab_tag`, so they are hidden while a lab is
// active — that is the spec's intent, not an oversight.
export function matchesLab(message: Pick<Message, 'lab_tag'>, labFilter: string | null): boolean {
  return labFilter === null || message.lab_tag === labFilter
}

// The chip set: the distinct tags present among live, non-deleted messages, ordered
// naturally so "Lab 2" precedes "Lab 10". A soft delete blanks `lab_tag`, so a deleted
// message never contributes a tag anyway; the guard is belt-and-braces.
export function distinctLabTags(
  messages: Pick<Message, 'lab_tag' | 'deleted_at'>[],
): string[] {
  const tags = new Set<string>()
  for (const message of messages) {
    if (!message.deleted_at && message.lab_tag) tags.add(message.lab_tag)
  }
  return [...tags].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )
}
