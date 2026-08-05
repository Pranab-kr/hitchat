const HOUR = 60 * 60 * 1000

// The 0.55 floor is a hard contrast requirement from design.md, not a stylistic
// choice — the oldest message must still clear WCAG AA.
export function ageOpacity(createdAt: string, now: number = Date.now()): number {
  const ageHours = (now - new Date(createdAt).getTime()) / HOUR

  if (ageHours < 2) return 1
  if (ageHours < 4) return 0.85
  if (ageHours < 6) return 0.7
  return 0.55
}
