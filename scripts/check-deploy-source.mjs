// Runs before every hosting deploy (firebase.json "predeploy"). The hosted
// site must be exactly what was reviewed and merged: the main branch as it is
// on GitHub, with no local edits. Node only, so it runs the same in PowerShell.
import { execFileSync } from 'node:child_process'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

function stop(message) {
  console.error(`\nNot deploying: ${message}\n`)
  process.exit(1)
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') stop(`this is the "${branch}" branch. Run "git switch main" and "git pull", then deploy again.`)

// New files count too (one in public/ would be published); ignored ones such as .env.local don't.
const edited = git('status', '--porcelain')
if (edited !== '') stop(`these files are changed or new here:\n${edited}\nUndo them, or commit them on a branch first.`)

try {
  git('fetch', '--quiet', 'origin', 'main')
} catch {
  stop('could not reach GitHub to compare main. Check the connection, then deploy again.')
}
const local = git('rev-parse', 'HEAD')
const remote = git('rev-parse', 'origin/main')
if (local !== remote) stop('main here is not the same as main on GitHub. Run "git pull", then deploy again.')

console.log(`Deploying main at ${local.slice(0, 7)}, the same as GitHub.`)
