import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'
import { offlineServiceWorker } from './vite.offline.ts'
import { noSecretsInBuild } from './vite.secrets.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), offlineServiceWorker(), noSecretsInBuild()],
  test: {
    // The Firestore rules tests need the emulator: `npm run test:rules` (vitest.rules.config.ts).
    exclude: [...configDefaults.exclude, 'tests/rules/**'],
  },
})
