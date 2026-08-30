'use client'

import { useCallback, useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import { postCode } from '@/app/actions/messages'
import { useAnonToken } from '@/lib/use-anon-token'
import { useComposerGate } from '@/lib/use-composer-gate'
import { authorColorVar } from '@/lib/author-color'
import { ALLOWED_LANGS } from '@/lib/validate'
import type { Message } from '@/lib/types'

// The unsent paste lives in localStorage, not component state: a student who switches
// to the lab manual and back (or fat-fingers a reload) keeps their code. Cleared only
// on a successful post, so an app-switch or an accidental Cancel never costs it.
// The store mirrors use-anon-token: the SNAPSHOT is the raw string (value-stable, so
// useSyncExternalStore never sees a "changed" object and loops), and the parsed draft
// is derived with useMemo. The storage event also syncs tabs.
const DRAFT_KEY = 'hitchat:code-draft'

type CodeDraft = { body: string; lang: string; title: string; labTag: string }

const EMPTY_DRAFT: CodeDraft = { body: '', lang: 'c', title: '', labTag: '' }

function parseDraft(raw: string | null): CodeDraft {
  if (!raw) return EMPTY_DRAFT
  try {
    const parsed = JSON.parse(raw) as Partial<CodeDraft>
    if (typeof parsed.body !== 'string') return EMPTY_DRAFT
    return {
      body: parsed.body,
      lang:
        typeof parsed.lang === 'string' &&
        (ALLOWED_LANGS as readonly string[]).includes(parsed.lang)
          ? parsed.lang
          : 'c',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      labTag: typeof parsed.labTag === 'string' ? parsed.labTag : '',
    }
  } catch {
    return EMPTY_DRAFT
  }
}

function readDraftRaw(): string | null {
  return localStorage.getItem(DRAFT_KEY)
}

const draftListeners = new Set<() => void>()

function emitDraft() {
  for (const l of draftListeners) l()
}

function subscribeDraft(onChange: () => void) {
  draftListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    draftListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

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
  const { bannedMessage, remaining, noteRateLimited } = useComposerGate(token)
  const raw = useSyncExternalStore(subscribeDraft, readDraftRaw, () => null)
  const draft = useMemo(() => parseDraft(raw), [raw])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const update = useCallback((patch: Partial<CodeDraft>) => {
    const next = { ...parseDraft(readDraftRaw()), ...patch }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
    } catch {
      // A private-mode quota error is not worth failing the composer over.
    }
    emitDraft()
  }, [])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
    emitDraft()
  }, [])

  function submit() {
    if (!token || !draft.body.trim() || remaining > 0) return

    startTransition(async () => {
      const result = await postCode({
        token,
        groupId,
        body: draft.body,
        lang: draft.lang,
        title: draft.title,
        labTag: draft.labTag,
        replyToId: replyTo?.id,
      })
      if (result.ok) {
        clear()
        onClose()
      } else if (result.code === 'rate_limited' && result.retryAfter) {
        noteRateLimited(result.retryAfter)
      } else {
        setError(result.message)
      }
    })
  }

  if (bannedMessage) {
    return (
      <div className="border-t border-hairline px-4 py-3 text-[15px] text-graphite">
        {bannedMessage}
      </div>
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
        </div>
      )}

      {error && (
        <p className="mb-2 font-mono text-[12px] text-rule" role="alert">
          {error}
        </p>
      )}

      {remaining > 0 && (
        <p className="mb-2 font-mono text-[12px] text-graphite" role="status">
          You&rsquo;re posting too fast. Wait {remaining}s.
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <input
          value={draft.labTag}
          onChange={(e) => update({ labTag: e.target.value })}
          aria-label="Lab tag"
          placeholder="Lab 4"
          className="touch-target w-24 rounded-input border border-hairline bg-surface px-3 py-2 font-mono text-[13px] text-ink placeholder:text-graphite"
        />

        <input
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          aria-label="Title"
          placeholder="What this does"
          className="touch-target flex-1 rounded-input border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-graphite"
        />

        <select
          value={draft.lang}
          onChange={(e) => update({ lang: e.target.value })}
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
        value={draft.body}
        onChange={(e) => update({ body: e.target.value })}
        aria-label="Code"
        placeholder="Paste your code"
        rows={8}
        className="w-full rounded-input border border-hairline bg-code-bg px-3 py-2 font-mono text-[13px] leading-[21px] text-ink placeholder:text-graphite"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || remaining > 0}
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

        {draft.body.length > 50000 && (
          <span className="ml-auto font-mono text-[12px] text-rule">
            {draft.body.length.toLocaleString('en-US')} / 50,000
          </span>
        )}
      </div>
    </div>
  )
}
