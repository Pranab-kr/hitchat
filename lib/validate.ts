// Must stay in sync with the code_lang_allowed check constraint (migration 0008) and
// with the grammars loaded in lib/highlight.ts. A language in this list but missing a
// grammar silently renders as plaintext; one missing from the constraint is rejected
// by the database after passing validation.
export const ALLOWED_LANGS = [
  'c', 'cpp', 'java', 'python', 'javascript', 'sql', 'bash',
  'html', 'css', 'verilog', 'plaintext',
] as const

const n = (x: number) => x.toLocaleString('en-US')

export function validateText(body: string): string | null {
  if (!body.trim()) return 'Type something first.'
  if (body.length > 1000) {
    return `Messages are 1,000 characters max. This is ${n(body.length)}.`
  }
  return null
}

export function validateCode(input: {
  body: string
  lang: string
  title?: string
  labTag?: string
}): string | null {
  if (!input.body.trim()) return 'Paste some code first.'
  if (input.body.length > 50000) {
    return `Code is 50,000 characters max. This is ${n(input.body.length)}.`
  }
  if (!ALLOWED_LANGS.includes(input.lang as (typeof ALLOWED_LANGS)[number])) {
    return 'Pick a language from the list.'
  }
  if (input.title && input.title.length > 80) {
    return `Title is 80 characters max. This is ${n(input.title.length)}.`
  }
  if (input.labTag && input.labTag.length > 24) {
    return `Lab tag is 24 characters max. This is ${n(input.labTag.length)}.`
  }
  return null
}
