const HOUR = 60 * 60 * 1000

// design.md "Aesthetic risk: fade with age" — amended 2026-08-30.
//
// The floor must clear WCAG AA (4.5:1) against the page background, and the same
// opacity cannot do that in both themes: `ink` at 0.55 over light `paper` measures
// 3.66:1 (fails), while `chalk` at 0.55 over dark `desk` measures 5.14:1 (passes).
// So the 6-8h floor is theme-dependent — 0.65 in light (4.99:1) keeps the designed
// 0.55 depth in dark where the darker background buys the contrast. `tests/age.test.ts`
// pins the measured ratios so a future edit cannot silently re-break the floor.
export function ageOpacity(createdAt: string, now: number = Date.now(), dark = false): number {
  const ageHours = (now - new Date(createdAt).getTime()) / HOUR

  if (ageHours < 2) return 1
  if (ageHours < 4) return 0.85
  if (ageHours < 6) return 0.7
  return dark ? 0.55 : 0.65
}
