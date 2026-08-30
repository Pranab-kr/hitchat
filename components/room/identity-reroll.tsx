'use client'

import { useAnonToken } from '@/lib/use-anon-token'

export function IdentityReroll() {
  const { reroll } = useAnonToken()

  return (
    <button
      type="button"
      onClick={reroll}
      title="Generate a new anonymous identity on this device"
      className="group touch-target flex flex-col items-end rounded-[4px] px-1.5 py-0.5 text-right transition-colors hover:bg-wash"
    >
      {/* The caption was once title-only — invisible to touch and to screen readers.
          The meaning now lives in the visible and accessible tree on every device. */}
      <span className="font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite transition-colors group-hover:text-pen">
        new identity
      </span>
      <span className="font-mono text-[11px] leading-4 text-graphite">
        fresh anonymous name
      </span>
    </button>
  )
}
