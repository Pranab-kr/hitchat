// The package cannot import from the app (it is published on its own, with no access to
// `lib/`), so the wire shapes are restated here. They are the JSON API's shapes and the
// app's tests pin the same fields on the other side.

export type RoomSummary = {
  path: string
  dept: string
  year: number
  batch: number
  group: string
  locked: boolean
}

export type AgentMessage = {
  id: string
  author: string
  kind: 'text' | 'code'
  body: string
  lang: string | null
  title: string | null
  lab_tag: string | null
  reply_to_id: string | null
  pinned: boolean
  created_at: string
  expires_at: string
  truncated?: true
}

export type SentMessage = {
  id: string
  room: string
  url: string
  expires_at: string
}

// snake_case on purpose: these are the API's field names, and an agent that learned them
// from the MCP schema should be able to use the same names in a curl call.
export type SendTextInput = {
  room: string
  text: string
  reply_to_id?: string
}

export type SendCodeInput = {
  room: string
  code: string
  lang: string
  title?: string
  lab_tag?: string
  reply_to_id?: string
}
