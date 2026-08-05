// Column-restricted roles cannot use `select *`, so every client query must name
// its columns. author_token_hash is never listed here — it is not granted to anon.

export const MESSAGE_COLUMNS = [
  'id',
  'group_id',
  'kind',
  'body',
  'code_lang',
  'code_title',
  'lab_tag',
  'reply_to_id',
  'author_name',
  'author_color',
  'admin_id',
  'is_pinned',
  'deleted_at',
  'created_at',
  'expires_at',
  'reaction_bump',
].join(', ')

export const ROOM_COLUMNS = 'id, batch_id, label, is_locked'
