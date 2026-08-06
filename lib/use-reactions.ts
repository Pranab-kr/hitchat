'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReactions, toggleReaction, type ReactionState } from '@/app/actions/reactions'
import { useAnonToken } from '@/lib/use-anon-token'

const EMPTY: ReactionState = { counts: {}, mine: [] }

// The `reaction_bump` UPDATE says *that* a message's reactions changed; it carries no
// counts. This is what fetches *what* changed — without it a second window never sees
// a count move. One batched call for the whole stream rather than one per row.
export function useReactions(messages: { id: string; reaction_bump: string }[]) {
  const { token } = useAnonToken()
  const [state, setState] = useState<Record<string, ReactionState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const pendingRef = useRef(new Set<string>())

  // The action caps the batch at 100; the stream can grow past that as messages arrive.
  const recent = messages.slice(-100)
  const idsKey = recent.map((m) => m.id).join(',')
  const signature = recent.map((m) => `${m.id}:${m.reaction_bump}`).join(',')

  useEffect(() => {
    if (!token || !idsKey) return
    const ids = idsKey.split(',')
    let alive = true

    // A burst of bumps (several people reacting at once) should cost one fetch.
    const timer = setTimeout(() => {
      void getReactions({ token, messageIds: ids }).then((result) => {
        if (alive && result.ok) setState((prev) => ({ ...prev, ...result.data }))
      })
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [token, idsKey, signature])

  const toggle = useCallback(
    async (messageId: string, emoji: string) => {
      if (!token || pendingRef.current.has(messageId)) return
      pendingRef.current.add(messageId)

      const before = state[messageId] ?? EMPTY
      const hadReaction = before.mine.includes(emoji)
      const optimistic: ReactionState = {
        counts: {
          ...before.counts,
          [emoji]: Math.max(0, (before.counts[emoji] ?? 0) + (hadReaction ? -1 : 1)),
        },
        mine: hadReaction
          ? before.mine.filter((value) => value !== emoji)
          : [...before.mine, emoji],
      }
      setState((prev) => ({ ...prev, [messageId]: optimistic }))
      setPending((prev) => ({ ...prev, [messageId]: true }))
      setErrors((prev) => {
        if (!prev[messageId]) return prev
        const next = { ...prev }
        delete next[messageId]
        return next
      })

      const result = await toggleReaction({ token, messageId, emoji })
      if (result.ok) {
        setState((prev) => ({ ...prev, [messageId]: result.data }))
        setErrors((prev) => {
          if (!prev[messageId]) return prev
          const next = { ...prev }
          delete next[messageId]
          return next
        })
      } else {
        setState((prev) => ({ ...prev, [messageId]: before }))
        setErrors((prev) => ({ ...prev, [messageId]: result.message }))
      }
      pendingRef.current.delete(messageId)
      setPending((prev) => ({ ...prev, [messageId]: false }))
    },
    [state, token],
  )

  return {
    reactionsFor: (id: string) => state[id] ?? EMPTY,
    errorFor: (id: string) => errors[id] ?? null,
    isPendingFor: (id: string) => pending[id] ?? false,
    toggle,
  }
}
