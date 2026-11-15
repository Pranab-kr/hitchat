'use client'

import { useState, useTransition } from 'react'
import { sendText } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { useComposerGate } from '@/lib/use-composer-gate'
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
  const { bannedMessage, remaining, noteRateLimited } = useComposerGate(token)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeMode, setCodeMode] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!token || !body.trim() || remaining > 0) return

    // Clear immediately so a successful press has visible feedback before the Server
    // Action round trip and Realtime insert return. A failure restores the untouched
    // draft, so a slow network never costs somebody their message.
    const draft = body
    const replyToId = replyTo?.id
    setBody('')
    setError(null)
    onClearReply?.()

    startTransition(async () => {
      const result = await sendText({
        token,
        groupId,
        body: draft,
        replyToId,
      })
      if (result.ok) {
        return
      }
      if (result.code === 'rate_limited' && result.retryAfter) {
        // The countdown is the message; a plain error line would tell the user what
        // the ticking seconds already show.
        noteRateLimited(result.retryAfter)
      } else {
        setError(result.message)
      }
      setBody((current) => current || draft)
    })
  }

  // Banned is a per-identity state and outranks the room lock: a banned student stays
  // blocked in an unlocked room. The server re-verifies on every write regardless.
  if (bannedMessage) {
    return (
      <div className="border-t border-hairline px-4 py-3 text-[15px] text-graphite">
        {bannedMessage}
      </div>
    )
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
        <div className="drop mb-2 flex items-center gap-2 border-l-2 border-pen pl-2 font-mono text-[12px] text-graphite">
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
        <p className="drop mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      {/* flex-wrap: at very narrow widths the send/code buttons drop below the input
          instead of squeezing it to nothing. */}
      <div className="flex flex-wrap gap-2">
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
          aria-label="Message"
          placeholder={replyTo ? 'Reply' : 'Message'}
          disabled={pending}
          className="touch-target min-w-0 flex-1 rounded-full border border-hairline bg-surface px-4 py-2 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-graphite hover:border-graphite/50 focus:border-pen focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--pen)_14%,transparent)]"
        />

        <button
          type="button"
          disabled={pending || !token || !body.trim() || remaining > 0}
          onClick={submit}
          className="press touch-target rounded-full bg-pen px-5 py-2 text-[13px] font-medium text-paper hover:brightness-110 disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setCodeMode(true)}
          className="press touch-target rounded-full border border-hairline px-4 py-2 font-mono text-[13px] text-graphite hover:border-pen hover:text-pen disabled:opacity-60"
        >
          {'</> code'}
        </button>
      </div>

      {pending && (
        <p className="mt-1 font-mono text-[12px] text-graphite" role="status">
          Sending message…
        </p>
      )}

      {remaining > 0 && (
        <p className="mt-1 font-mono text-[12px] text-graphite" role="status">
          You&rsquo;re posting too fast. Wait {remaining}s.
        </p>
      )}

      {body.length > 1000 && (
        <p className="mt-1 text-right font-mono text-[12px] text-rule">
          {body.length.toLocaleString('en-US')} / 1,000
        </p>
      )}
    </div>
  )
}
