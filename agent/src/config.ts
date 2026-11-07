import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

// The only state the package keeps. It holds a URL and a token and nothing else — no
// secret, no per-room cache. `HITCHAT_CONFIG` exists so tests (and anyone juggling two
// hosts) can move the file; HITCHAT_URL/HITCHAT_TOKEN override its values for one-off
// runs and CI, per the design.

export type Config = { url: string; token: string }

export function configPath(): string {
  const override = process.env.HITCHAT_CONFIG
  if (override) return override
  return path.join(homedir(), '.config', 'hitchat', 'config.json')
}

export function readConfig(): Config | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(configPath(), 'utf8'))
  } catch {
    // Absent, unreadable, or not JSON: all three mean "no usable config".
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const { url, token } = parsed as Record<string, unknown>
  if (typeof url !== 'string' || typeof token !== 'string') return null
  if (!url.trim() || !token.trim()) return null

  return { url, token }
}

export function writeConfig(config: Config): void {
  const file = configPath()
  mkdirSync(path.dirname(file), { recursive: true })
  // 0o600 like the token files it is modelled on. On Windows the mode is a no-op; the
  // path stays the same everywhere so the docs remain true.
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

// The environment wins over the file field by field, so a CI job can point at a preview
// host while reusing the token already on disk.
export function resolveConfig(
  env: Record<string, string | undefined> = process.env,
): Config | null {
  const file = readConfig()
  const url = env.HITCHAT_URL?.trim() || file?.url
  const token = env.HITCHAT_TOKEN?.trim() || file?.token

  if (!url || !token) return null
  return { url, token }
}
