import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/auth/session'
import { SudoForm } from '@/components/admin/sudo-form'

// Unlisted: nothing in the app links here, so keep it out of indexes too.
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default async function SudoPage() {
  if (await verifySession()) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh max-w-[380px] flex-col justify-center px-6">
      {/* No marigold anywhere on this page. It signals "an admin is present" and nobody
          is authenticated yet; spending it here would blunt the badge in the stream. */}
      <div className="rounded-card border border-hairline bg-surface px-6 py-6">
        <h1 className="text-[20px] leading-7 font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-[15px] leading-6 text-graphite">
          Admin access. Students never need this page.
        </p>

        <SudoForm />
      </div>

      <p className="mt-4 px-1 font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
        Sessions last 7 days.
      </p>
    </main>
  )
}
