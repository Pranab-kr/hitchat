'use client'

import { useState, useTransition } from 'react'
import { deleteRoom } from '@/app/actions/rooms'
import type { AdminRole } from '@/lib/auth/session'

type Room = {
  id: string
  label: string
  createdByAdminId: string | null
  creatorIsAnon: boolean
}

type Department = {
  id: string
  name: string
  slug: string
  years: { id: string; number: number; batches: { id: string; number: number; groups: Room[] }[] }[]
}

export function SudoRooms({
  departments,
  session,
}: {
  departments: Department[]
  session: { adminId: string; role: AdminRole }
}) {
  const [items, setItems] = useState(departments)

  function removeRoom(groupId: string) {
    setItems((current) =>
      current
        .map((department) => ({
          ...department,
          years: department.years
            .map((year) => ({
              ...year,
              batches: year.batches
                .map((batch) => ({
                  ...batch,
                  groups: batch.groups.filter((group) => group.id !== groupId),
                }))
                .filter((batch) => batch.groups.length > 0),
            }))
            .filter((year) => year.batches.length > 0),
        }))
        .filter((department) => department.years.length > 0),
    )
  }

  return (
    <div className="space-y-4">
      {items.map((department) => (
        <DepartmentCard
          key={department.id}
          department={department}
          session={session}
          onDeleted={removeRoom}
        />
      ))}
    </div>
  )
}

function DepartmentCard({
  department,
  session,
  onDeleted,
}: {
  department: Department
  session: { adminId: string; role: AdminRole }
  onDeleted: (groupId: string) => void
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-5 py-4">
      <h3 className="text-[15px] leading-6 font-semibold text-ink">
        {department.name}{' '}
        <span className="font-mono text-[12px] font-normal text-graphite">/{department.slug}</span>
      </h3>
      <ul className="mt-2 space-y-1">
        {department.years.map((year) =>
          year.batches.map((batch) => (
            <li key={batch.id} className="font-mono text-[12px] leading-5 text-graphite">
              year {year.number} — batch {batch.number}
              <span className="ml-1 inline-flex flex-wrap gap-1">
                {batch.groups.map((group) => (
                  <RoomDeleteButton
                    key={group.id}
                    group={group}
                    session={session}
                    onDeleted={onDeleted}
                  />
                ))}
              </span>
            </li>
          )),
        )}
      </ul>
    </div>
  )
}

function RoomDeleteButton({
  group,
  session,
  onDeleted,
}: {
  group: Room
  session: { adminId: string; role: AdminRole }
  onDeleted: (groupId: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const allowed = session.role === 'owner' || group.createdByAdminId === session.adminId

  if (!allowed) return null

  function remove() {
    startTransition(async () => {
      const result = await deleteRoom({ groupId: group.id })
      if (!result.ok) {
        setConfirming(false)
        setNotice(result.message)
        return
      }
      onDeleted(group.id)
    })
  }

  if (confirming) {
    return (
      <span className="ml-1 inline-flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="rounded-input border border-rule px-1.5 py-0.5 text-rule hover:bg-rule/10 disabled:opacity-40"
        >
          {pending ? 'deleting…' : `delete ${group.label}`}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="text-graphite">
          keep
        </button>
      </span>
    )
  }

  return (
    <span className="ml-1 inline-flex items-center">
      <button
        type="button"
        aria-label={`delete room ${group.label}`}
        onClick={() => {
          setNotice(null)
          setConfirming(true)
        }}
        className="rounded-input px-1.5 py-0.5 text-graphite hover:text-rule"
      >
        ×
      </button>
      {notice && <span role="status" className="ml-1 text-rule">{notice}</span>}
    </span>
  )
}
