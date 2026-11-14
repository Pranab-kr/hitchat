'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Every creation form below refreshes the server component on success so the tree it
// just changed is re-read. Structure lives in Postgres and is not in the Realtime
// publication, so nothing pushes these changes on its own.
export function useRefreshOnNotice(notice: string | null) {
  const router = useRouter()
  const seen = useRef<string | null>(null)

  useEffect(() => {
    if (notice && notice !== seen.current) {
      seen.current = notice
      router.refresh()
    }
  }, [notice, router])
}
