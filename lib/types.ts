export type Message = {
  id: string
  group_id: string
  kind: 'text' | 'code'
  body: string
  code_lang: string | null
  code_title: string | null
  lab_tag: string | null
  reply_to_id: string | null
  author_name: string
  author_color: string
  admin_id: string | null
  is_pinned: boolean
  deleted_at: string | null
  created_at: string
  expires_at: string
  reaction_bump: string
}
