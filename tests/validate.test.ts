import { describe, it, expect } from 'vitest'
import { validateText, validateCode, ALLOWED_LANGS } from '../lib/validate'

describe('validateText', () => {
  it('accepts normal text', () => {
    expect(validateText('anyone done q2?')).toBeNull()
  })

  it('rejects empty text', () => {
    expect(validateText('   ')).toBe('Type something first.')
  })

  it('rejects text over 1000 chars and names the real numbers', () => {
    const msg = validateText('x'.repeat(1001))
    expect(msg).toBe('Messages are 1,000 characters max. This is 1,001.')
  })

  it('accepts exactly 1000 chars', () => {
    expect(validateText('x'.repeat(1000))).toBeNull()
  })
})

describe('validateCode', () => {
  it('accepts a valid code post', () => {
    expect(validateCode({ body: 'int main(){}', lang: 'c' })).toBeNull()
  })

  it('rejects empty code', () => {
    expect(validateCode({ body: '  ', lang: 'c' })).toBe('Paste some code first.')
  })

  it('rejects code over 20000 chars and names the real numbers', () => {
    const msg = validateCode({ body: 'x'.repeat(20001), lang: 'c' })
    expect(msg).toBe('Code is 20,000 characters max. This is 20,001.')
  })

  it('rejects a language outside the allowed set', () => {
    expect(validateCode({ body: 'x', lang: 'rust' })).toBe('Pick a language from the list.')
  })

  it('rejects a title over 80 chars', () => {
    expect(validateCode({ body: 'x', lang: 'c', title: 'y'.repeat(81) })).toBe(
      'Title is 80 characters max. This is 81.',
    )
  })

  it('rejects a lab tag over 24 chars', () => {
    expect(validateCode({ body: 'x', lang: 'c', labTag: 'z'.repeat(25) })).toBe(
      'Lab tag is 24 characters max. This is 25.',
    )
  })

  it('allows exactly the eight documented languages', () => {
    expect([...ALLOWED_LANGS]).toEqual([
      'c', 'cpp', 'java', 'python', 'javascript', 'sql', 'bash', 'plaintext',
    ])
  })

  it('accepts every allowed language', () => {
    for (const lang of ALLOWED_LANGS) {
      expect(validateCode({ body: 'x', lang })).toBeNull()
    }
  })

  it('accepts the exact boundary lengths', () => {
    expect(validateCode({ body: 'x'.repeat(20000), lang: 'c' })).toBeNull()
    expect(validateCode({ body: 'x', lang: 'c', title: 'y'.repeat(80) })).toBeNull()
    expect(validateCode({ body: 'x', lang: 'c', labTag: 'z'.repeat(24) })).toBeNull()
  })

  // The DB check constraint is on char_length, so validation must agree or the
  // insert throws a raw Postgres error instead of a readable message.
  it('rejects an empty language rather than passing it to the DB', () => {
    expect(validateCode({ body: 'x', lang: '' })).toBe('Pick a language from the list.')
  })
})
