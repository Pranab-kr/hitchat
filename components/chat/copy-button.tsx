'use client'

import { useState } from 'react'

// design.md specifies '⧉ copy'. U+29C9 is in zero of the bundled fonts and no
// monospace family on a stock Linux install, so it renders as tofu. This inline SVG
// is the same two-overlapping-squares mark with no font dependency.
function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-[12px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  )
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Insecure context or a denied permission. Nothing useful to say; leave the
      // label alone rather than claiming a copy that did not happen.
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="touch-target flex shrink-0 items-center gap-1 font-mono text-[12px] text-graphite transition-colors hover:text-pen"
    >
      {copied ? <span aria-hidden>✓</span> : <CopyIcon />}
      {copied ? 'copied' : 'copy'}
    </button>
  )
}
