// design.md § Author colors — the light column. Changing one means redoing its contrast
// and deltaE separation checks in BOTH themes. See progress.md.
//
// This module is deliberately not server-only: the palette has to be readable from
// client components to resolve a stored hex back to its theme-aware variable.
export const AUTHOR_COLORS = [
  '#873C1D', // rust
  '#6B6424', // olive
  '#42602E', // fern
  '#257E44', // jade
  '#2E5B60', // teal
  '#2064B6', // cobalt
  '#6B30A6', // violet
  '#8E295C', // magenta
] as const

const INDEX = new Map(AUTHOR_COLORS.map((hex, i) => [hex.toLowerCase(), i + 1]))

// messages.author_color stores the LIGHT hex. Rendering it inline in dark mode puts a
// 2.2–3.6:1 handle on the dark background — every one of the eight fails WCAG AA. The
// --author-N variables in globals.css carry both columns and swap with the .dark class,
// so resolve to the variable and let CSS pick.
export function authorColorVar(stored: string): string {
  const i = INDEX.get(stored.trim().toLowerCase())
  return i ? `var(--author-${i})` : 'var(--ink)'
}
