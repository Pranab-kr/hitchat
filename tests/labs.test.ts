import { describe, it, expect } from 'vitest'
import { matchesLab, distinctLabTags } from '../lib/labs'

// A code post carries a tag; a text post carries null. Deleted posts have their tag
// blanked (moderation.ts), modeled here with a non-null deleted_at.
const post = (lab_tag: string | null, deleted_at: string | null = null) => ({ lab_tag, deleted_at })

describe('matchesLab', () => {
  it('shows every message when no lab is selected', () => {
    expect(matchesLab({ lab_tag: 'Lab 4' }, null)).toBe(true)
    expect(matchesLab({ lab_tag: null }, null)).toBe(true)
  })

  it('shows only posts carrying the selected tag', () => {
    expect(matchesLab({ lab_tag: 'Lab 4' }, 'Lab 4')).toBe(true)
    expect(matchesLab({ lab_tag: 'Lab 3' }, 'Lab 4')).toBe(false)
  })

  // Prove-by-breaking: a text message (no lab_tag) MUST be hidden while a lab is active.
  // If the predicate were loosened to also pass untagged messages, this flips to true and
  // the test fails — which is the whole point of the filter existing.
  it('hides text messages (no lab_tag) while a lab is active', () => {
    expect(matchesLab({ lab_tag: null }, 'Lab 4')).toBe(false)
  })
})

describe('distinctLabTags', () => {
  it('returns unique tags in natural (numeric-aware) order', () => {
    expect(
      distinctLabTags([post('Lab 10'), post('Lab 2'), post('Lab 2'), post(null)]),
    ).toEqual(['Lab 2', 'Lab 10'])
  })

  it('ignores deleted messages, whose tag is blanked on delete', () => {
    expect(
      distinctLabTags([post('Lab 4', '2026-01-01T00:00:00Z'), post('Lab 5')]),
    ).toEqual(['Lab 5'])
  })

  it('is empty when no post carries a tag', () => {
    expect(distinctLabTags([post(null), post(null)])).toEqual([])
  })
})
