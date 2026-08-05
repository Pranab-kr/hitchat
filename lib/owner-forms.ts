// Form state shapes for the owner pages.
//
// These live outside the 'use server' files on purpose: every export of a 'use server'
// module must be an async function, so exporting a plain object from one makes the
// whole module throw at import time ("A 'use server' file can only export async
// functions, found object") and every form on the page 500s on submit.
// Type-only exports are erased at compile time and would be fine; these are runtime
// values and are not.

export type StructureState = { error: string | null; notice: string | null }

export const emptyStructureState: StructureState = { error: null, notice: null }

// `secret` is rendered exactly once and never persisted. It rides in form state rather
// than the database, which is what makes "you won't see it again" literally true.
export type AdminsState = {
  error: string | null
  notice: string | null
  secret: string | null
  secretFor: string | null
}

export const emptyAdminsState: AdminsState = {
  error: null,
  notice: null,
  secret: null,
  secretFor: null,
}

export type AdminSummary = {
  id: string
  displayName: string
  role: 'owner' | 'co_admin'
  createdAt: string
  revokedAt: string | null
}
