import 'server-only'
import { createHash } from 'node:crypto'

// One compact handle token rather than a three-word display name. The two hash-picked
// syllables cover cool, professional, playful, Linux, and meme-adjacent moods without
// ever implying a colour (the name and colour use independent hash slices).
const PREFIXES = [
  'Aero', 'Axiom', 'Bash', 'Bit', 'Bonk', 'Bug', 'Byte', 'Civic',
  'Code', 'Dev', 'Doge', 'Echo', 'Flux', 'Hex', 'Kilo', 'Kernel',
  'Luma', 'Nano', 'Neo', 'Nix', 'Nova', 'Orbit', 'Pixel', 'Praxis',
  'Prime', 'Stack', 'Tux', 'Vector', 'Vibe', 'Wave', 'Yeet', 'Zen',
] as const

const SUFFIXES = [
  'Bot', 'Byte', 'Cat', 'Core', 'Crow', 'Daemon', 'Forge', 'Fox',
  'Goblin', 'Hawk', 'Kit', 'Lab', 'Lynx', 'Mint', 'Moth', 'Node',
  'Ops', 'Otter', 'Panda', 'Ping', 'Root', 'Rune', 'Shift', 'Spark',
  'Wave', 'Wolf', 'Yak', 'Zero', 'Zip', 'Zorb', 'Loop', 'Nerd',
] as const

// design.md § Author colors. Defined in lib/author-color.ts so client components can
// resolve a stored hex to its theme-aware variable without importing this server module.
export { AUTHOR_COLORS } from './author-color'
import { AUTHOR_COLORS } from './author-color'

export function hashToken(token: string): string {
  const pepper = process.env.IDENTITY_PEPPER
  if (!pepper) throw new Error('IDENTITY_PEPPER is not set')
  return createHash('sha256').update(token + pepper).digest('hex')
}

export function deriveHandle(hash: string): { name: string; color: string } {
  const prefix = PREFIXES[parseInt(hash.slice(0, 4), 16) % PREFIXES.length]
  const suffix = SUFFIXES[parseInt(hash.slice(4, 8), 16) % SUFFIXES.length]
  const number = parseInt(hash.slice(8, 12), 16) % 1000
  const color = AUTHOR_COLORS[parseInt(hash.slice(12, 16), 16) % AUTHOR_COLORS.length]

  return {
    name: `${prefix}${suffix}${String(number).padStart(3, '0')}`,
    color,
  }
}
