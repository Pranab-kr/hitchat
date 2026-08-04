import { notFound } from 'next/navigation'
import { getServiceClient } from '@/lib/supabase/admin'
import { MESSAGE_COLUMNS } from '@/lib/columns'
import { MessageList } from '@/components/chat/message-list'
import type { Message } from '@/lib/types'

export const dynamic = 'force-dynamic'

type RoomParams = { dept: string; year: string; batch: string; group: string }

export default async function RoomPage({ params }: { params: Promise<RoomParams> }) {
  const { dept, year, batch, group } = await params

  // Reject non-numeric path segments before querying: Number('abc') is NaN, and
  // .eq('number', NaN) makes PostgREST 400 rather than 404.
  const yearNumber = Number(year)
  const batchNumber = Number(batch)
  if (!Number.isInteger(yearNumber) || !Number.isInteger(batchNumber)) notFound()

  const db = getServiceClient()

  const { data: room } = await db
    .from('groups')
    .select(
      'id, label, is_locked, batches!inner(number, years!inner(number, departments!inner(slug, name)))',
    )
    .eq('label', group.toUpperCase())
    .eq('batches.number', batchNumber)
    .eq('batches.years.number', yearNumber)
    .eq('batches.years.departments.slug', dept)
    .maybeSingle()

  if (!room) notFound()

  const { data: messages } = await db
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', room.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  const initial = ((messages ?? []) as unknown as Message[]).reverse()

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-hairline px-4 py-3">
        <h1 className="font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">
          {room.label}
        </h1>
      </header>

      <MessageList groupId={room.id} initial={initial} labFilter={null} />
    </div>
  )
}
