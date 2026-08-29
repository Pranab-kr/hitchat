'use client'

import { useState, useTransition } from 'react'
import { postCode } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { authorColorVar } from '@/lib/author-color'
import { ALLOWED_LANGS } from '@/lib/validate'
import type { Message } from '@/lib/types'

export function CodeComposer({
  groupId,
  replyTo = null,
  onClose,
}: {
  groupId: string
  replyTo?: Message | null
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
      const result = await postCode({
        token,
        groupId,
        body,
        lang,
        title,
        labTag,
        replyToId: replyTo?.id,
      })
      if (result.ok) {
        onClose()
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 border-l-2 border-pen pl-2 font-mono text-[12px] text-graphite">
          <span>replying to</span>
          <span style={{ color: authorColorVar(replyTo.author_color) }}>
            {replyTo.author_name}
          </span>
          <span className="truncate">
            {replyTo.kind === 'code' ? 'code' : replyTo.body}
          </span>
        </div>
      )}

      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <input
          value={labTag}
          onChange={(e) => setLabTag(e.target.value)}
          aria-label="Lab tag"
          placeholder="Lab 4"
          className="touch-target w-24 rounded-input border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink placeholder:text-graphite"
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
          placeholder="What this does"
          className="touch-target flex-1 rounded-input border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-graphite"
        />

        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Language"
          className="touch-target rounded-input border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink"
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
        aria-label="Code"
        placeholder="Paste your code"
        rows={8}
        className="w-full rounded-input border border-hairline bg-code-bg px-3 py-2 font-mono text-[13px] leading-[21px] text-ink placeholder:text-graphite"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="touch-target rounded-input bg-pen px-4 py-2 text-[13px] font-medium text-paper disabled:opacity-60"
        >
          {pending ? 'Posting…' : 'Post code'}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-input px-4 py-2 text-[13px] text-graphite transition-colors hover:text-ink"
        >
          Cancel
        </button>

        {body.length > 50000 && (
          <span className="ml-auto font-mono text-[12px] text-rule">
            {body.length.toLocaleString('en-US')} / 50,000
          </span>
        )}
      </div>
    </div>
  )
}
