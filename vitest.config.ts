import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Task 5 onward, integration tests run Server Actions for real and need the
// service-role key and pepper, so all of .env.local is loaded deliberately.
const testEnv = loadEnv('test', process.cwd(), '')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    env: testEnv,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // server-only's main entry is a bare throw; empty.js is what Next resolves on the server.
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
})
