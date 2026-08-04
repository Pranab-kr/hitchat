import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Vitest does not read .env.local into process.env on its own, and tests/rls.test.ts
// needs the live Supabase URL + publishable key. Only the NEXT_PUBLIC_ prefix is
// loaded on purpose: server-only secrets (SUPABASE_SERVICE_ROLE_KEY, IDENTITY_PEPPER,
// OWNER_SECRET) must not be handed to the test environment.
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
    alias: { '@': path.resolve(__dirname, './') },
  },
})
