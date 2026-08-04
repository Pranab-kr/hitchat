import type { ThemeRegistrationRaw } from 'shiki/core'

// Every hex here is a design.md token: ink, code-bg, graphite, pen, rule, marigold.
// A stock Shiki theme would put Dracula colors inside a warm-paper palette.

export const hitLight: ThemeRegistrationRaw = {
  name: 'hit-light',
  type: 'light',
  fg: '#241E1A',
  bg: '#F5EFEA',
  settings: [
    { scope: ['comment'], settings: { foreground: '#6E645C', fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.control'],
      settings: { foreground: '#2C5F8F' },
    },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#C8503F' } },
    {
      scope: ['constant.numeric', 'constant.language'],
      settings: { foreground: '#E5A03A' },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: '#2C5F8F' },
    },
    { scope: ['variable', 'entity.name.type'], settings: { foreground: '#241E1A' } },
  ],
}

export const hitDark: ThemeRegistrationRaw = {
  name: 'hit-dark',
  type: 'dark',
  fg: '#EDE6DE',
  bg: '#26201C',
  settings: [
    { scope: ['comment'], settings: { foreground: '#9A8F86', fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.control'],
      settings: { foreground: '#7FB0DC' },
    },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#D9705F' } },
    {
      scope: ['constant.numeric', 'constant.language'],
      settings: { foreground: '#F0B657' },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: '#7FB0DC' },
    },
    { scope: ['variable', 'entity.name.type'], settings: { foreground: '#EDE6DE' } },
  ],
}
