import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Only NEXT_PUBLIC_ is loaded: server secrets must stay out of the test env.
const publicEnv = loadEnv('test', process.cwd(), 'NEXT_PUBLIC_')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    env: publicEnv,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // server-only's main entry is a bare throw; empty.js is what Next resolves on the server.
      'server-only': path.resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
})
