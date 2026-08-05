import 'server-only'
import { verifySession } from '@/lib/auth/session'

// Reading the admin session is best-effort on the message path. cookies() throws
// outside a request scope, and a failure to read the session must mean "treat them as
// a student", never "fail the post" and never "assume admin". The fallback direction
// is deliberate: this function can only ever remove privilege, never grant it.
export async function currentAdminId(): Promise<string | null> {
  try {
    const session = await verifySession()
    return session?.adminId ?? null
  } catch {
    return null
  }
}
