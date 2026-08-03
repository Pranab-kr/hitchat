'use client'

import { useSyncExternalStore } from 'react'

// The React-sanctioned way to render a different value after hydration: the server
// snapshot is false and the client snapshot true, so React re-renders once post-hydrate
// without the setState-in-effect that `useEffect(() => setMounted(true))` requires and
// that React's lint rule rejects.
//
// These three must stay module-level so their identities are stable across renders —
// a fresh `subscribe` on every render makes useSyncExternalStore resubscribe in a loop.
const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
