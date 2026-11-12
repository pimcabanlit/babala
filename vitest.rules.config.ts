import { defineConfig } from 'vitest/config'

/**
 * The Firestore rules tests. They talk to the Firestore emulator, so run them
 * with `npm run test:rules`, which starts it, never on their own.
 */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    // One emulator: test files must not clear each other's data mid-test.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
