'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCoAdminForm, revokeAdminForm } from '@/app/actions/admins'
import { emptyAdminsState, type AdminSummary } from '@/lib/owner-forms'
import {
  Card,
  Field,
  FormError,
  SubmitButton,
} from '@/components/admin/owner-shell'

function SecretPanel({ secret, name }: { secret: string; name: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Rejects in an insecure context or on a denied permission. Saying nothing is
      // better than claiming a copy that never happened — the secret is on screen and
      // can still be selected by hand.
      setCopied(false)
    }
  }

  return (
    <div className="mt-4 rounded-card border-l-2 border-l-marigold bg-marigold/12 px-4 py-3">
      <p className="font-mono text-[12px] leading-4 tracking-[0.02em] text-ink">
        Secret for {name}. Copy this now. You won&apos;t be able to see it again.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-input border border-hairline bg-paper px-2 py-1.5 font-mono text-[13px] leading-5 break-all text-ink select-all">
          {secret}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-input border border-hairline px-2 py-1 font-mono text-[12px] leading-4 text-graphite transition-colors hover:border-pen hover:text-pen"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
    </div>
  )
}

function CreateCoAdmin() {
  const [state, action, pending] = useActionState(createCoAdminForm, emptyAdminsState)
  const router = useRouter()
  const seen = useRef<string | null>(null)

  useEffect(() => {
    // Refresh the list when a new admin appears, but keyed on the secret so the
    // refresh happens once — a refresh loop would blow away the panel below.
    if (state.secret && state.secret !== seen.current) {
      seen.current = state.secret
      router.refresh()
    }
  }, [state.secret, router])

  return (
    <Card title="New co-admin">
      <p className="mt-1 text-[15px] leading-6 text-graphite">
        A custom secret can be set or auto-generated, and is shown once. There is no way
        to look it up later — if it is lost, revoke the admin and make a new one.
      </p>

      <form action={action} className="mt-4 space-y-3">
        <Field
          id="admin-name"
          name="displayName"
          label="name you will recognise"
          placeholder="Lab Assistant"
          autoComplete="off"
          required
        />
        <Field
          id="admin-custom-secret"
          name="customSecret"
          label="custom secret (leave blank to auto-generate)"
          placeholder="optional (min. 8 characters)"
          autoComplete="off"
        />
        {state.error && <FormError>{state.error}</FormError>}
        <SubmitButton pending={pending}>Create co-admin</SubmitButton>
      </form>

      {state.secret && state.secretFor && (
        <SecretPanel secret={state.secret} name={state.secretFor} />
      )}
    </Card>
  )
}

function AdminRow({ admin }: { admin: AdminSummary }) {
  const [state, action, pending] = useActionState(revokeAdminForm, emptyAdminsState)
  const router = useRouter()
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (state.notice && state.notice !== seen.current) {
      seen.current = state.notice
      router.refresh()
    }
  }, [state.notice, router])

  const revoked = admin.revokedAt !== null

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-3 last:border-b-0">
      <div>
        <span className="text-[15px] leading-6 text-ink">{admin.displayName}</span>{' '}
        <span className="font-mono text-[12px] leading-4 text-graphite">
          {admin.role === 'owner' ? 'owner' : 'co-admin'}
          {revoked && ' · revoked'}
        </span>
        {state.error && <FormError>{state.error}</FormError>}
      </div>

      {/* The owner has no revoke control at all. revokeAdmin refuses it server-side
          too — this only keeps a button that can never succeed off the screen. */}
      {admin.role !== 'owner' && !revoked && (
        <form action={action}>
          <input type="hidden" name="adminId" value={admin.id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-input border border-hairline px-2 py-1 font-mono text-[12px] leading-4 text-graphite transition-colors hover:border-rule hover:text-rule disabled:opacity-40"
          >
            {pending ? 'revoking…' : 'revoke'}
          </button>
        </form>
      )}
    </li>
  )
}

export function AdminsPanel({ admins }: { admins: AdminSummary[] }) {
  const active = admins.filter((a) => a.revokedAt === null)
  const revoked = admins.filter((a) => a.revokedAt !== null)

  return (
    <div className="space-y-6">
      <CreateCoAdmin />

      <Card title="Admins">
        <ul className="mt-2">
          {active.map((a) => (
            <AdminRow key={a.id} admin={a} />
          ))}
        </ul>

        {revoked.length > 0 && (
          <>
            <h3 className="mt-5 font-mono text-[12px] leading-4 tracking-[0.08em] text-graphite uppercase">
              revoked
            </h3>
            <ul className="mt-1">
              {revoked.map((a) => (
                <AdminRow key={a.id} admin={a} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}
