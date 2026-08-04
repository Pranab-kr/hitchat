'use server'

import { highlightCode } from '@/lib/highlight'
import { ALLOWED_LANGS } from '@/lib/validate'

// Public and unauthenticated, so it enforces the same bounds as postCode — otherwise
// it is a free CPU sink for arbitrary input.
export async function renderCode(code: string, lang: string): Promise<string> {
  if (code.length > 20000) return ''
  const safe = ALLOWED_LANGS.includes(lang as (typeof ALLOWED_LANGS)[number])
    ? lang
    : 'plaintext'
  return highlightCode(code, safe)
}
