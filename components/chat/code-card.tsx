'use client'

import { CopyButton } from './copy-button'

// Presentational only: the caller supplies already-highlighted HTML — from the server on
// first paint, from the renderCode action for messages arriving over Realtime.
export function CodeCard({
  code,
  html,
  lang,
  title,
  labTag,
}: {
  code: string
  html: string | null
  lang: string
  title?: string | null
  labTag?: string | null
}) {
  const lineCount = code.split('\n').length
  const isLong = lineCount > 15

  const body = (
    <div
      className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[21px]"
      // Safe: Shiki escapes every '<' in the input (asserted in tests/highlight.test.ts).
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  )

  return (
    <div className="my-2 flex overflow-hidden rounded-card border border-hairline bg-code-bg">
      {/* Nothing else in the app uses a vertical rule. That exclusivity is the point. */}
      <div className="w-[2px] shrink-0 bg-rule" aria-hidden />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2">
          {labTag && (
            <span className="shrink-0 font-mono text-[12px] tracking-[0.02em] text-rule">
              {labTag}
            </span>
          )}
          {title && (
            <span className="truncate text-[13px] font-medium text-ink">{title}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[12px] text-graphite">
            {lang}
          </span>
          <CopyButton text={code} />
        </div>

        {isLong ? (
          <details className="group">
            <summary className="cursor-pointer list-none px-4 py-2 font-mono text-[12px] text-graphite transition-colors hover:text-pen [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">⌄ show {lineCount} lines</span>
              <span className="hidden group-open:inline">⌃ collapse</span>
            </summary>
            {body}
          </details>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
