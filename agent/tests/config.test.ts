import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { configPath, readConfig, resolveConfig, writeConfig } from '../src/config'

// HITCHAT_CONFIG exists so the CLI's config can be pointed at a scratch file. The CLI is
// a separate package with no test database and no server, so every case here is a plain
// filesystem round-trip.
function scratchFile(): { file: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'hitchat-config-'))
  return {
    file: path.join(dir, 'nested', 'config.json'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

function withEnv(file: string): () => void {
  const previous = process.env.HITCHAT_CONFIG
  process.env.HITCHAT_CONFIG = file
  return () => {
    if (previous === undefined) delete process.env.HITCHAT_CONFIG
    else process.env.HITCHAT_CONFIG = previous
  }
}

describe('configPath', () => {
  it('honours HITCHAT_CONFIG', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      expect(configPath()).toBe(file)
    } finally {
      restore()
      cleanup()
    }
  })

  it('falls back to ~/.config/hitchat/config.json', () => {
    const previous = process.env.HITCHAT_CONFIG
    delete process.env.HITCHAT_CONFIG
    try {
      expect(configPath().endsWith(path.join('.config', 'hitchat', 'config.json'))).toBe(true)
    } finally {
      if (previous !== undefined) process.env.HITCHAT_CONFIG = previous
    }
  })
})

describe('writeConfig / readConfig', () => {
  it('round-trips url and token through a missing directory', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      writeConfig({ url: 'http://localhost:3000', token: 'a'.repeat(36) })
      expect(readConfig()).toEqual({ url: 'http://localhost:3000', token: 'a'.repeat(36) })
    } finally {
      restore()
      cleanup()
    }
  })

  it('returns null when the file is absent', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      expect(readConfig()).toBeNull()
    } finally {
      restore()
      cleanup()
    }
  })

  it('returns null when the JSON lacks either key', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      // writeConfig creates the parent directory, so the malformed files below have a
      // real directory to land in.
      writeConfig({ url: 'http://localhost:3000', token: 'a'.repeat(36) })

      writeFileSync(file, JSON.stringify({ url: 'http://localhost:3000' }))
      expect(readConfig()).toBeNull()

      writeFileSync(file, JSON.stringify({ token: 'a'.repeat(36) }))
      expect(readConfig()).toBeNull()

      writeFileSync(file, 'not json at all')
      expect(readConfig()).toBeNull()
    } finally {
      restore()
      cleanup()
    }
  })
})

describe('resolveConfig', () => {
  it('lets HITCHAT_URL and HITCHAT_TOKEN override the file', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      writeConfig({ url: 'http://from-file', token: 'file-token' })

      expect(resolveConfig({ HITCHAT_URL: 'http://from-env' })).toEqual({
        url: 'http://from-env',
        token: 'file-token',
      })

      expect(resolveConfig({ HITCHAT_TOKEN: 'env-token' })).toEqual({
        url: 'http://from-file',
        token: 'env-token',
      })
    } finally {
      restore()
      cleanup()
    }
  })

  it('returns null when neither source supplies both values', () => {
    const { file, cleanup } = scratchFile()
    const restore = withEnv(file)
    try {
      expect(resolveConfig({})).toBeNull()
      expect(resolveConfig({ HITCHAT_URL: 'http://only-url' })).toBeNull()
    } finally {
      restore()
      cleanup()
    }
  })
})
