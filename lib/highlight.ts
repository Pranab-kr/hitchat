import 'server-only'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import { hitLight, hitDark } from './shiki-theme'

let highlighterPromise: Promise<HighlighterCore> | undefined

// One highlighter per server process. Constructing one per request leaks badly.
function getHighlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [hitLight, hitDark],
    langs: [
      import('@shikijs/langs/c'),
      import('@shikijs/langs/cpp'),
      import('@shikijs/langs/java'),
      import('@shikijs/langs/python'),
      import('@shikijs/langs/javascript'),
      import('@shikijs/langs/sql'),
      import('@shikijs/langs/bash'),
      import('@shikijs/langs/html'),
      import('@shikijs/langs/css'),
      import('@shikijs/langs/verilog'),
    ],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  })
  return highlighterPromise
}

// Which grammars actually loaded. A language allowed by validate.ts but missing here
// degrades silently to plaintext, so a test asserts these two lists agree.
export async function loadedLanguages(): Promise<string[]> {
  return (await getHighlighter()).getLoadedLanguages()
}

export async function highlightCode(code: string, lang: string): Promise<string> {  const highlighter = await getHighlighter()

  // 'plaintext' is a SpecialLanguage — it needs no grammar.
  const loaded = highlighter.getLoadedLanguages()
  const safeLang = lang === 'plaintext' || loaded.includes(lang) ? lang : 'plaintext'

  return highlighter.codeToHtml(code, {
    lang: safeLang,
    themes: { light: 'hit-light', dark: 'hit-dark' },
    // Variables only. 'light-dark()' is media-query driven and would ignore .dark.
    defaultColor: false,
  })
}
