'use client'

import { useOnlineCount } from '@/lib/use-online-count'

export function OnlineCount({ groupId }: { groupId: string }) {
  const count = useOnlineCount(groupId)

  return (
    <span className="font-mono text-[12px] text-graphite">
      {count} online
    </span>
  )
}
