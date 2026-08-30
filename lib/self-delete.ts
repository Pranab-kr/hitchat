// The 5-minute self-delete window, shared with the spec and deleteOwnMessage. The
// client hides the delete control outside it; the Server Action re-verifies the same
// bound independently.
export const SELF_DELETE_WINDOW_MS = 5 * 60 * 1000

// Matches deleteOwnMessage's `ageMs > 5 * 60 * 1000` refusal exactly: the window is
// inclusive on the client (<=) so the control never disappears a moment before the
// action would still accept the retract.
export function withinSelfDeleteWindow(createdAt: string | Date, now: number): boolean {
  return now - new Date(createdAt).getTime() <= SELF_DELETE_WINDOW_MS
}
