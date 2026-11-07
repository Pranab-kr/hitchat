// The origin printed on /agent. One variable names this address on both sides of the wire:
// HITCHAT_URL is what the server advertises here, and what the CLI and MCP server read on a
// user's machine to know where to send. Set it only when the site's public address differs
// from what requests report; otherwise the request's own host is the truth.

type OriginInputs = {
  /** HITCHAT_URL — the site's public address, when it is not what requests report. */
  hitchatUrl?: string | null
  forwardedHost?: string | null
  host?: string | null
  forwardedProto?: string | null
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']

// Proxies chain these headers, so the client's value is the first entry.
function first(value: string | null | undefined): string | null {
  const head = value?.split(',')[0]?.trim()
  return head ? head : null
}

function isLocal(host: string): boolean {
  return LOCAL_HOSTS.includes(host.split(':')[0].toLowerCase())
}

// Trailing slashes off, missing scheme on. Everything downstream concatenates strings.
function normalize(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function resolveOrigin(inputs: OriginInputs): string {
  const explicit = first(inputs.hitchatUrl)
  if (explicit) return normalize(explicit)

  const host = first(inputs.forwardedHost) ?? first(inputs.host)
  if (!host) return 'http://localhost:3000'

  const proto = first(inputs.forwardedProto) ?? (isLocal(host) ? 'http' : 'https')
  return normalize(`${proto}://${host}`)
}
