import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServiceClient } from '@/lib/supabase/admin'
import { getRoomTree } from '@/lib/room-tree'
import { findRoomByPath } from '@/lib/rooms-server'
import { ordinal, type DeptNode } from '@/lib/rooms'
import { MESSAGE_COLUMNS } from '@/lib/columns'
import { highlightCode } from '@/lib/highlight'
import { verifySession } from '@/lib/auth/session'
import { MessageList } from '@/components/chat/message-list'
import { RoomTree, type CurrentRoom } from '@/components/room/room-tree'
import { MobileRoomNav } from '@/components/room/mobile-room-nav'
import { AdminBar } from '@/components/room/admin-bar'
import { RoomDelete } from '@/components/room/room-delete'
import { OnlineCount } from '@/components/room/online-count'
import { IdentityReroll } from '@/components/room/identity-reroll'
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

  // Shared with the agent surfaces (lib/rooms-server.ts), so a room an agent can post to
  // is exactly a room this page can render. Mixed-case slugs and labels now resolve
  // instead of 404ing, because both sides normalise before querying.
  const room = await findRoomByPath(dept, yearNumber, batchNumber, group)
  if (!room) notFound()

  const deptName = room.deptName

  // The same tree the `/` picker renders, so the in-room index and the picker never
  // drift. Tiny query; the page is already force-dynamic.
  const tree: DeptNode[] = await getRoomTree()
  const current: CurrentRoom = {
    deptSlug: dept,
    year: yearNumber,
    batch: batchNumber,
    group: room.label,
  }

  const { data: messages } = await db
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', room.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  const initial = ((messages ?? []) as unknown as Message[]).reverse()

  // Highlighted server-side so code is readable on first paint and without JS. Messages
  // arriving later over Realtime go through the renderCode action instead.
  const codeMessages = initial.filter((m) => m.kind === 'code' && !m.deleted_at)
  const rendered = await Promise.all(
    codeMessages.map(async (m) => [
      m.id,
      await highlightCode(m.body, m.code_lang ?? 'plaintext'),
    ]),
  )
  const initialCodeHtml = Object.fromEntries(rendered) as Record<string, string>

  // Controls the presence of the moderation UI only. Every moderation action
  // re-verifies its own session server-side; this flag is never authorization.
  const session = await verifySession()
  const isAdmin = session !== null
  // Same presentation-only rule as the moderation controls: this decides whether the
  // room page offers a delete button, and deleteRoom re-derives ownership server-side
  // before it removes anything. An anonymous creator cannot be recognised here at all —
  // its token lives in localStorage — so RoomDelete asks once after mount for those.
  const canDeleteRoom =
    session !== null &&
    (session.role === 'owner' || room.createdByAdminId === session.adminId)
  const ownerAdminIds = isAdmin
    ? (
        await db
          .from('admins')
          .select('id')
          .eq('role', 'owner')
          .is('revoked_at', null)
      ).data?.map((admin) => admin.id) ?? []
    : []

  return (
    <div className="flex h-dvh">
      {/* The notebook index. Fixed rail from md up; a drawer below (MobileRoomNav). */}
      <aside className="hidden w-[260px] shrink-0 border-r border-hairline md:flex">
        <RoomTree tree={tree} current={current} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <MobileRoomNav tree={tree} current={current} />
            <div className="min-w-0">
              <p className="truncate font-mono text-[12px] leading-4 tracking-[0.02em] text-graphite">
                {deptName} · {ordinal(yearNumber)} year · Batch {batchNumber}
              </p>
              <h1 className="min-w-0 truncate font-display text-[32px] leading-[36px] font-semibold tracking-[-0.02em] text-ink">
                {/* The room title doubles as the home link — back to the room picker. */}
                <Link
                  href="/"
                  prefetch
                  title="Back to the room picker"
                  className="block truncate rounded-[4px] transition-colors hover:text-pen"
                >
                  {room.label}
                </Link>
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <IdentityReroll />
            <OnlineCount groupId={room.id} />
          </div>
        </header>

        <RoomDelete
          groupId={room.id}
          label={room.label}
          canDelete={canDeleteRoom}
          creatorIsAnon={room.creatorIsAnon}
        />

        {isAdmin && (
          <AdminBar groupId={room.id} locked={room.isLocked} role={session.role} />
        )}

        <MessageList
          groupId={room.id}
          locked={room.isLocked}
          initial={initial}
          initialCodeHtml={initialCodeHtml}
          isAdmin={isAdmin}
          adminRole={session?.role ?? null}
          ownerAdminIds={ownerAdminIds}
        />
      </div>
    </div>
  )
}
