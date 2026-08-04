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

// design.md § Author colors. Changing one means redoing its contrast and separation checks.
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
