// SGFN — Service Worker
// Stratégie : network-first pour tout (app dynamique Supabase).
// Cache l'app shell pour un démarrage rapide et une page offline de secours.

const CACHE = "sgfn-shell-v1";
const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [
  "/",
  "/login",
  "/offline.html",
  "/manifest.json",
  "/logo-officiel.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install : pré-cache l'app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: "reload" })))
        .catch(() => {}) // Ne pas bloquer si un asset manque
    )
  );
  self.skipWaiting();
});

// ── Activate : nettoyer les anciens caches ────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch : network-first, fallback cache, fallback offline ──────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ne pas intercepter les requêtes non-GET ni les API Supabase
  if (request.method !== "GET") return;
  if (request.url.includes("supabase.co")) return;
  if (request.url.includes("functions/v1")) return;
  if (request.url.includes("chrome-extension")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Mettre en cache la réponse fraîche pour les assets statiques
        if (response.ok && (request.url.match(/\.(js|css|png|svg|ico|woff2?)(\?|$)/))) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        // Réseau indisponible : chercher dans le cache
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Page HTML non cachée → page offline
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match(OFFLINE_URL);
          }
        })
      )
  );
});
