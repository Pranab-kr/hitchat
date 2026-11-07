// The origin that goes into a config a person pastes somewhere else. A request-derived
// origin alone is not good enough: browse a local build and the page hands out
// `http://localhost:3000`, which is useless in anyone else's editor. So explicit config
// wins, then the hosting platform's production domain, then the request, and localhost
// only as the last resort for `next dev`.

type OriginInputs = {
  /** SITE_URL — the canonical public origin for this deployment. */
  siteUrl?: string | null
  /** Vercel's production domain, a bare host with no scheme. */
  platformHost?: string | null
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
  const name = host.split(':')[0].toLowerCase()
  return LOCAL_HOSTS.includes(name)
}

// Strips trailing slashes and gives a bare host an https:// scheme, because everything
// downstream builds URLs by string concatenation.
function normalize(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function resolveOrigin(inputs: OriginInputs): string {
  const explicit = first(inputs.siteUrl)
  if (explicit) return normalize(explicit)

  const platform = first(inputs.platformHost)
  if (platform) return normalize(platform)

  const host = first(inputs.forwardedHost) ?? first(inputs.host)
  if (!host) return 'http://localhost:3000'

  const proto = first(inputs.forwardedProto) ?? (isLocal(host) ? 'http' : 'https')
  return normalize(`${proto}://${host}`)
}
