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

// The failed copy carries its warning as an exclamation in `rule` — a drawn mark, so
// the danger cue survives on the code-card surface (rule is a UI surface at 3.0 floor).
// The word stays `graphite`, which clears 4.5:1; rule-as-text on the code card measures
// ~3.9:1 in light and fails, so the color never carries the message alone.
function AlertMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-[12px] text-rule"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3v6.5" />
      <path d="M8 12v.1" />
    </svg>
  )
}

type CopyState = 'idle' | 'copied' | 'failed'

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Insecure context or a denied permission. The button now says why it failed
      // instead of standing there dead — same 1.5s confirm rhythm as the success.
      setState('failed')
      setTimeout(() => setState('idle'), 1500)
      return
    }
    setState('copied')
    setTimeout(() => setState('idle'), 1500)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="touch-target flex shrink-0 items-center gap-1 font-mono text-[12px] text-graphite transition-colors hover:text-pen"
    >
      {state === 'copied' ? <span aria-hidden>✓</span> : state === 'failed' ? <AlertMark /> : <CopyIcon />}
      {state === 'copied' ? 'copied' : state === 'failed' ? "couldn't copy" : 'copy'}
    </button>
  )
}
