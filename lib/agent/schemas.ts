import { z } from 'zod'
import { ALLOWED_LANGS } from '@/lib/validate'

// The wire shape, shared by the JSON API and (in phase 5) the hosted MCP tool inputs.
// snake_case is deliberate: an agent sees the same field names on both surfaces.

export const textBodySchema = z.object({
  room: z.string().min(1),
  text: z.string(),
  reply_to_id: z.uuid().optional(),
})

export const codeBodySchema = z.object({
  room: z.string().min(1),
  code: z.string(),
  lang: z.enum(ALLOWED_LANGS),
  title: z.string().max(80).optional(),
  lab_tag: z.string().max(24).optional(),
  reply_to_id: z.uuid().optional(),
})
