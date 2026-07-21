/**
 * Contrôle visuel des pages PUBLIQUES, depuis l'export statique `out/`.
 *
 * Pendant de `e2e-shot.mjs`, qui ouvre une session : ici aucune connexion, on
 * sert `out/` en imitant la réécriture .htaccess (`/x/` → `x.html`) et on
 * photographie clair / sombre / mobile. Comme e2e-shot, on remonte les deux
 * défauts qu'une capture ne montre pas : débordement horizontal et erreurs
 * console.
 *
 *   pnpm build                                   # out/ doit être à jour
 *   node scripts/e2e-shot-public.mjs --routes=/,/metiers/chefferie/
 *
 * Les captures atterrissent dans .shots/ (non suivi).
 */
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(RACINE, "out");
const SHOTS = join(RACINE, ".shots");
const PORT = 4321;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const bare = a.replace(/^--/, "");
    const i = bare.indexOf("=");
    return i === -1 ? [bare, true] : [bare.slice(0, i), bare.slice(i + 1)];
  }),
);
const routes = String(args.routes ?? "/").split(",").filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

/** Reproduit la résolution de l'hôte : /x/ → x.html, sinon 404.html. */
function resoudre(urlPath) {
  const p = decodeURIComponent(urlPath.split("?")[0]);
  const direct = join(OUT, p);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const sansSlash = p.replace(/\/$/, "");
  const html = join(OUT, sansSlash + ".html");
  if (existsSync(html)) return html;
  const index = join(OUT, sansSlash, "index.html");
  if (existsSync(index)) return index;
  if (p === "/" || p === "") return join(OUT, "index.html");
  return join(OUT, "404.html");
}

if (!existsSync(join(OUT, "index.html"))) {
  console.error("out/ absent ou vide — lancer `pnpm build` d'abord.");
  process.exit(2);
}

const server = createServer(async (req, res) => {
  const f = resoudre(req.url);
  try {
    const buf = await readFile(f);
    res.writeHead(200, { "Content-Type": MIME[extname(f)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

await mkdir(SHOTS, { recursive: true });
// Mêmes drapeaux que e2e-shot.mjs : sans eux Chromium résout Supabase via
// DNS-over-HTTPS et échoue, alors que Node joint le même hôte.
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});

let echec = false;
for (const route of routes) {
  const nom = "public" + (route === "/" ? "-accueil" : route.replace(/\//g, "-").replace(/-$/, ""));
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const erreurs = [];
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
  page.on("pageerror", (e) => erreurs.push(String(e)));

  // Ni `networkidle` ni `load` ne sont fiables ici : la page charge les polices
  // depuis le CDN Google et interroge Supabase, deux dépendances réseau qui
  // peuvent ne jamais se stabiliser. On attend le DOM, puis un délai fixe.
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(SHOTS, `${nom}-clair.png`), fullPage: true });

  const toggle = page.locator('header button[aria-label*="thème" i], header button[aria-label*="theme" i]').first();
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(SHOTS, `${nom}-sombre.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(SHOTS, `${nom}-mobile.png`), fullPage: true });

  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(route);
  console.log(`  captures    : .shots/${nom}-{clair,sombre,mobile}.png`);
  console.log(`  débordement : ${debordement} px${debordement > 0 ? "  ⚠️ défilement latéral" : ""}`);
  console.log(`  console     : ${erreurs.length ? erreurs.slice(0, 5).join(" | ") : "aucune erreur"}`);
  if (debordement > 0 || erreurs.length) echec = true;
  await page.close();
}

await browser.close();
server.close();
process.exit(echec ? 1 : 0);
