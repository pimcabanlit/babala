import { loadEnv, type Plugin } from 'vite'

/** Settings from .env.local that must never reach the hosted site. */
const NEVER_SHIPPED = ['VITE_APPCHECK_DEBUG_TOKEN'] as const

/**
 * Stops a production build that contains the App Check debug token. The
 * hosted site is built on a laptop that has the token in .env.local, and
 * anyone holding it can pass App Check and spend the AI quota. The code reads
 * it only in development (src/firebase/index.ts); this catches a change that
 * brings it back.
 */
export function noSecretsInBuild(): Plugin {
  let secrets: { key: string; value: string }[] = []
  return {
    name: 'babala-no-secrets-in-build',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || config.root, 'VITE_')
      secrets = NEVER_SHIPPED.map((key) => ({ key, value: (env[key] ?? '').trim() })).filter((s) => s.value !== '')
    },
    generateBundle(_options, bundle) {
      for (const [name, output] of Object.entries(bundle)) {
        const text =
          output.type === 'chunk' ? output.code : typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source)
        for (const { key, value } of secrets) {
          // Names the setting, never the value, so the build log can't leak it either.
          if (text.includes(value)) this.error(`${name} contains the value of ${key} from .env.local. Nothing was built; never deploy a build with it.`)
        }
      }
    },
  }
}
