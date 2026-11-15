'use client'

import { useOnlineCount } from '@/lib/use-online-count'

export function OnlineCount({ groupId }: { groupId: string }) {
  const count = useOnlineCount(groupId)

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] leading-4 text-graphite">
      <span aria-hidden className="size-1.5 rounded-full bg-pen" />
      {count} online
    </span>
  )
}
