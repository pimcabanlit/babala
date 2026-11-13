import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

const TEMPLATE = 'src/offline/sw.js'

/** Every file under dir, as paths relative to it with forward slashes. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
}

/**
 * Writes sw.js into the build: the service worker in src/offline/sw.js, with
 * the list of every built and public file to keep on the phone, and a version
 * that changes whenever any of them changes. A new version makes the phone
 * install a fresh copy and drop the old one. Build only: the dev server has
 * no service worker.
 */
export function offlineServiceWorker(): Plugin {
  let publicDir = ''
  return {
    name: 'babala-offline-service-worker',
    apply: 'build',
    // After Vite writes index.html into the bundle, so the list and the version include it.
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_options, bundle) {
      const hash = createHash('sha256')
      const files = new Set<string>()
      for (const [name, output] of Object.entries(bundle)) {
        if (name.endsWith('.map')) continue
        files.add(name)
        hash.update(name).update(output.type === 'chunk' ? output.code : output.source)
      }
      for (const name of filesUnder(publicDir)) {
        files.add(name)
        hash.update(name).update(readFileSync(join(publicDir, name)))
      }
      // Opening the page with no signal depends on it.
      if (!files.has('index.html')) this.error('index.html is not in the bundle, so the service worker could not keep it.')
      const template = readFileSync(TEMPLATE, 'utf8')
      hash.update(template)
      const list = [...files].sort().map((name) => `/${name}`)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace("'__BABALA_VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 16)))
          .replace('__BABALA_FILES__', JSON.stringify(list)),
      })
    },
  }
}
