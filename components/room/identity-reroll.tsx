'use client'

import { useAnonToken } from '@/lib/use-anon-token'

export function IdentityReroll() {
  const { reroll } = useAnonToken()

  return (
    <button
      type="button"
      onClick={reroll}
      title="Generate a new anonymous identity on this device"
      className="rounded-[4px] px-1.5 py-0.5 font-mono text-[12px] tracking-[0.02em] text-graphite transition-colors hover:bg-wash hover:text-pen"
    >
      new identity
    </button>
  )
}
