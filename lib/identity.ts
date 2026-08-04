import 'server-only'
import { createHash } from 'node:crypto'

// No color words: the adjective and color come from different hash slices.
const ADJECTIVES = [
  'Quiet', 'Brisk', 'Steady', 'Nimble', 'Bright', 'Keen', 'Swift', 'Bold',
  'Clever', 'Patient', 'Restless', 'Curious', 'Gentle', 'Sharp', 'Eager', 'Calm',
] as const

const ANIMALS = [
  'Falcon', 'Otter', 'Heron', 'Lynx', 'Marten', 'Gecko', 'Raven', 'Bison',
  'Tapir', 'Ibis', 'Shrew', 'Civet', 'Kite', 'Vole', 'Hare', 'Newt',
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
  const adjective = ADJECTIVES[parseInt(hash.slice(0, 4), 16) % ADJECTIVES.length]
  const animal = ANIMALS[parseInt(hash.slice(4, 8), 16) % ANIMALS.length]
  const number = parseInt(hash.slice(8, 12), 16) % 100
  const color = AUTHOR_COLORS[parseInt(hash.slice(12, 16), 16) % AUTHOR_COLORS.length]

  return {
    name: `${adjective} ${animal} ${String(number).padStart(2, '0')}`,
    color,
  }
}
