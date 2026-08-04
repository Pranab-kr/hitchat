import '@testing-library/jest-dom/vitest'
import { JSDOM } from 'jsdom'

// Node 26 predefines an inert `localStorage` getter on globalThis, and vitest skips any
// key already present there, so jsdom's Storage never lands. Borrow a real one.
if (typeof window !== 'undefined' && typeof globalThis.localStorage === 'undefined') {
  const { localStorage } = new JSDOM('', { url: 'http://localhost:3000' }).window
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  })
}
