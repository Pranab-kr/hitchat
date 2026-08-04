'use client'

import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'hitchat:token'

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

// Minting happens here, not in render: subscribe runs post-mount, so the snapshot read
// stays pure. The useEffect+setState form is an eslint error under react-hooks.
function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)

  if (!localStorage.getItem(KEY)) {
    localStorage.setItem(KEY, crypto.randomUUID())
    emit()
  }

  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function getSnapshot(): string | null {
  return localStorage.getItem(KEY)
}

function getServerSnapshot(): string | null {
  return null
}

export function useAnonToken() {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const reroll = useCallback(() => {
    localStorage.setItem(KEY, crypto.randomUUID())
    emit()
  }, [])

  return { token, reroll }
}
