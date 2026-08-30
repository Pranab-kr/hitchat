// Client-safe room-hierarchy types and the ordinal helper. Deliberately free of any
// server-only import so client components (the sidebar tree) can import these directly.
// The server fetch that produces this shape lives in lib/room-tree.ts.

export type GroupNode = { label: string }
export type BatchNode = { number: number; groups: GroupNode[] }
export type YearNode = { number: number; batches: BatchNode[] }
export type DeptNode = { id: string; name: string; slug: string; years: YearNode[] }

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th']
export const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`
