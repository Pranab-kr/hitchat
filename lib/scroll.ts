// Auto-scroll stays pinned only while the reader is already at the bottom. "Near
// bottom" is 120px: a reader whose viewport still shows the newest row is at the
// bottom, a reader deep in history is not.
export const NEAR_BOTTOM_OFFSET = 120

export function isNearBottom(el: HTMLElement, offset = NEAR_BOTTOM_OFFSET): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < offset
}
