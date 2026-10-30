/* ============================================================
   SERVICE WORKER — Gota REAL
   - Carregamento mais rápido (recursos estáticos em cache)
   - Pré-requisito de instalação em versões mais antigas do Chrome
   - A API (pedidos, login) NUNCA é cacheada — dados sempre frescos
   ============================================================ */

const VERSION = 'gota-real-v0.2.3'
const STATIC_CACHE = `${VERSION}-static`

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // API e tempo-real: sempre rede, nunca cache
  if (url.pathname.startsWith('/api/')) return

  // navegação (abrir a app): rede primeiro, cache só quando estiver offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match('/'))
        )
    )
    return
  }

  // recursos estáticos: cache primeiro (são imutáveis / com hash no nome)
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname.startsWith('/gota-real-logo') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/robots.txt'
  if (!isStatic) return

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy))
          return res
        })
    )
  )
})
