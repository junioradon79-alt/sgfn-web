// SGNF — Service Worker
// Stratégie : network-first pour tout (app dynamique Supabase).
// Cache l'app shell pour un démarrage rapide et une page offline de secours.

const CACHE = "sgnf-shell-v2";
const OFFLINE_URL = "/offline.html";

// Les routes portent leur barre finale, et c'est la seule forme qui fonctionne.
// Vérifié sur sgfn.ci le 21/07 : `/login` répond 301 vers `/login/`, que
// l'`.htaccess` sert ensuite depuis `login.html`. Le worker suivait bien la
// redirection et mettait la page en cache — mais sous la clé demandée,
// `/login`, alors que l'application navigue vers `/login/`. Les clés de cache
// se comparent à l'URL exacte : la correspondance échouait, et l'utilisateur
// hors ligne recevait la page « hors connexion » au lieu de l'écran de
// connexion pourtant présent dans le cache.
const SHELL_ASSETS = [
  "/",
  "/login/",
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
      // Un par un, et non `addAll` : celui-ci est atomique. Aucun asset ne
      // manque aujourd'hui, mais le jour où l'un d'eux disparaîtra, `addAll`
      // abandonnerait la totalité du pré-cache — et le `.catch()` qui
      // l'entourait rendait cet abandon muet. Précaution, pas correctif.
      Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
        )
      )
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

// ── Message : activation immédiate demandée par la page ──────────────────────
// `RegisterSW.tsx` poste ce message dès qu'une nouvelle version est installée.
// Sans cet écouteur il ne déclenchait rien ; l'activation ne tenait qu'au
// `skipWaiting()` de l'install, laissant les deux fichiers en désaccord.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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
          if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
            return caches.match(OFFLINE_URL).then(
              (page) => page ?? new Response("Hors connexion", { status: 503 })
            );
          }
          // Asset non caché : rendre une réponse explicite. La branche
          // précédente ne retournait rien ; `respondWith` recevait alors
          // `undefined`, ce que la spécification traite en erreur réseau —
          // signalée au journal comme un défaut du worker plutôt que comme
          // l'absence de réseau qu'elle est. `pwa-verify.mjs` contrôle
          // désormais que ce cas rend bien un 504.
          return new Response("", { status: 504, statusText: "Hors connexion" });
        })
      )
  );
});
