'use client'

import { useActionState } from 'react'
import { loginFormAction, type LoginState } from '@/app/actions/admin'

const initial: LoginState = { error: null }

export function SudoForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, initial)

  return (
    <form action={formAction} className="mt-6">
      <label
        htmlFor="secret"
        className="font-mono text-[12px] font-medium tracking-[0.02em] text-graphite"
      >
        secret
      </label>

      {/* No maxLength and no minLength: the server decides, and a client-side hint about
          the shape of an admin secret is a hint worth not giving. */}
      <input
        id="secret"
        name="secret"
        type="password"
        autoComplete="off"
        autoFocus
        required
        aria-describedby={state.error ? 'secret-error' : undefined}
        className="mt-1 block w-full rounded-input border border-hairline bg-paper px-3 py-2 font-mono text-[13px] leading-[21px] text-ink"
      />

      {state.error && (
        // `rule` as 12px text measures 4.28:1 on the card in light mode, under the 4.5
        // floor. It carries the meaning as a border instead, with `ink` on a rule-tinted
        // wash for the text: 13.81:1 light, 11.86:1 dark, and no new color.
        <p
          id="secret-error"
          role="alert"
          className="mt-2 border-l-2 border-rule bg-rule/10 px-2 py-1.5 font-mono text-[12px] leading-4 tracking-[0.02em] text-ink"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-input bg-pen px-4 py-2 text-[13px] leading-5 font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  )
}
