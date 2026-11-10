/**
 * Service worker de Plan Financiero: permite ABRIR la app sin conexión.
 *
 * Estrategias:
 *  - Navegaciones (HTML): red primero → si no hay red, la última copia guardada.
 *    Así un deploy nuevo se ve en la siguiente visita con conexión.
 *  - /_next/static/* e íconos: caché primero (llevan hash en el nombre: nunca cambian).
 *  - Supabase y otros orígenes: NO se tocan. Los datos los maneja la outbox de la app.
 *
 * Al cambiar este archivo, subí VERSION para descartar las cachés viejas.
 */
const VERSION = "v1"
const PAGES = `pages-${VERSION}`
const ASSETS = `assets-${VERSION}`
const APP_SHELL = ["/", "/login", "/manifest.webmanifest", "/icons/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined) // sin red al instalar: se completa en la próxima visita
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/** La página nos pasa los recursos que ya cargó (antes de que este SW existiera). */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return
  const sameOrigin = event.data.urls.filter((url) => new URL(url, self.location.href).origin === self.location.origin)
  event.waitUntil(
    caches.open(ASSETS).then((cache) => Promise.all(sameOrigin.map((url) => cache.add(url).catch(() => undefined))))
  )
})

const isStaticAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirst(request) {
  const cache = await caches.open(PAGES)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    // Sin red: la página pedida (ignorando ?query y #hash) o, en su defecto, la app.
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match("/")) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone())
  return response
}
