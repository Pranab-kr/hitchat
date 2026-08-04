'use client'

import { useState, useTransition } from 'react'
import { sendText } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { CodeComposer } from './code-composer'

export function Composer({ groupId, locked }: { groupId: string; locked: boolean }) {
  const { token } = useAnonToken()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeMode, setCodeMode] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!token || !body.trim()) return

    startTransition(async () => {
      const result = await sendText({ token, groupId, body })
      if (result.ok) {
        setBody('')
        setError(null)
      } else {
        setError(result.message)
      }
    })
  }

  if (locked) {
    return (
      <div className="border-t border-hairline px-4 py-3 text-[15px] text-graphite">
        This room is read-only right now.
      </div>
    )
  }

  if (codeMode) {
    return <CodeComposer groupId={groupId} onClose={() => setCodeMode(false)} />
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Message"
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
