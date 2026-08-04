'use client'

import { useState, useTransition } from 'react'
import { postCode } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { ALLOWED_LANGS } from '@/lib/validate'

export function CodeComposer({
  groupId,
  onClose,
}: {
  groupId: string
  onClose: () => void
}) {
  const { token } = useAnonToken()
  const [body, setBody] = useState('')
  const [lang, setLang] = useState<string>('c')
  const [title, setTitle] = useState('')
  const [labTag, setLabTag] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!token) return

    startTransition(async () => {
      const result = await postCode({ token, groupId, body, lang, title, labTag })
      if (result.ok) {
        onClose()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      <div className="mb-2 flex gap-2">
        <input
          value={labTag}
          onChange={(e) => setLabTag(e.target.value)}
          placeholder="Lab 4"
          className="w-24 rounded-input border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink placeholder:text-graphite"
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What this does"
          className="flex-1 rounded-input border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-graphite"
        />

        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-input border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink"
        >
          {ALLOWED_LANGS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste your code"
        rows={8}
        className="w-full rounded-input border border-hairline bg-code-bg px-3 py-2 font-mono text-[13px] leading-[21px] text-ink placeholder:text-graphite"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-input bg-pen px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? 'Posting…' : 'Post code'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-input px-4 py-2 text-[13px] text-graphite transition-colors hover:text-ink"
        >
          Cancel
        </button>

        {body.length > 20000 && (
          <span className="ml-auto font-mono text-[12px] text-rule">
            {body.length.toLocaleString('en-US')} / 20,000
          </span>
        )}
      </div>
    </div>
  )
}
