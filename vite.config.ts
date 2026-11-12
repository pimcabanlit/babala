import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // The Firestore rules tests need the emulator: `npm run test:rules` (vitest.rules.config.ts).
    exclude: [...configDefaults.exclude, 'tests/rules/**'],
  },
})
