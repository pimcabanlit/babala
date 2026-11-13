// Babala's service worker: keeps the app itself on the phone, so the resident
// view opens with no signal. The alerts are saved separately, by the page
// (src/resident/useResidentPack.ts). The build (vite.offline.ts) fills in the
// version and the list of files, so each build installs a fresh cache and
// removes the last one.
//
// It never touches other sites (Firebase, Google sign-in, reCAPTCHA) or
// anything that isn't a GET, so it can't cache an alert or a sign-in.

const VERSION = '__BABALA_VERSION__'
const FILES = __BABALA_FILES__
const CACHE = `babala-${VERSION}`
// The files were saved by the worker itself, with no Origin header. A module
// script asks with one, so a server's "Vary: Origin" would hide every saved file.
const LOOKUP = { cacheName: CACHE, ignoreVary: true }

// With a weak signal a page load can hang for a long time. After this long the
// saved page opens instead; it still shows the alerts saved on the phone.
const NETWORK_WAIT_MS = 3000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('babala-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Firebase Hosting's reserved paths (/__/...) include the sign-in helper: always the network.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return

  if (request.mode === 'navigate') {
    event.respondWith(openPage(request))
    return
  }
  event.respondWith(caches.match(request, LOOKUP).then((saved) => saved ?? fetch(request)))
})

/** The page from the network when it answers in time, so updates arrive; otherwise the saved page. */
function openPage(request) {
  const network = fetch(request)
  // A late failure after the saved page was used needs no handling; an early one is caught below.
  network.catch(() => undefined)
  const saved = () => caches.match('/index.html', LOOKUP)
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT_MS))
  return Promise.race([network, timeout.then(saved)])
    .then((response) => response ?? network)
    .catch(() => saved().then((page) => page ?? Response.error()))
}
