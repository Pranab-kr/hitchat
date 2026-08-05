'use client'

import { useState, useTransition } from 'react'
import { sendText } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { authorColorVar } from '@/lib/author-color'
import { CodeComposer } from './code-composer'
import type { Message } from '@/lib/types'

export function Composer({
  groupId,
  locked,
  isAdmin = false,
  replyTo = null,
  onClearReply,
}: {
  groupId: string
  locked: boolean
  isAdmin?: boolean
  replyTo?: Message | null
  onClearReply?: () => void
}) {
  const { token } = useAnonToken()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeMode, setCodeMode] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!token || !body.trim()) return

    startTransition(async () => {
      const result = await sendText({
        token,
        groupId,
        body,
        replyToId: replyTo?.id,
      })
      if (result.ok) {
        setBody('')
        setError(null)
        onClearReply?.()
      } else {
        setError(result.message)
      }
    })
  }

  // Admins are exempt from the lock (spec: "read-only for students; admins can still
  // post"), so hiding their composer would make that exemption unreachable. This is
  // presentation only — sendText derives the exemption from the session cookie, never
  // from this prop.
  if (locked && !isAdmin) {
    return (
      <div className="border-t border-hairline px-4 py-3 text-[15px] text-graphite">
        This room is read-only right now.
      </div>
    )
  }

  if (codeMode) {
    return (
      <CodeComposer
        groupId={groupId}
        replyTo={replyTo}
        onClose={() => {
          setCodeMode(false)
          onClearReply?.()
        }}
      />
    )
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
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="ml-auto shrink-0 px-1 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {/* No maxLength: silent truncation at 1000 would make the over-length message
            from validateText unreachable, and pasted code loses its tail without a word. */}
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && replyTo) {
              e.preventDefault()
              onClearReply?.()
              return
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={replyTo ? 'Reply' : 'Message'}
          disabled={pending}
          className="flex-1 rounded-input border border-hairline bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-graphite"
        />

        <button
          type="button"
          onClick={() => setCodeMode(true)}
          className="rounded-input border border-hairline px-3 py-2 font-mono text-[13px] text-graphite transition-colors hover:border-pen hover:text-pen"
        >
          {'</> code'}
        </button>
      </div>

      {body.length > 1000 && (
        <p className="mt-1 text-right font-mono text-[12px] text-rule">
          {body.length.toLocaleString('en-US')} / 1,000
        </p>
      )}
    </div>
  )
}
