/**
 * Contrôle de ce qu'une capture d'écran ne voit JAMAIS : les surfaces qui
 * s'ouvrent — boîtes de dialogue, menus, listes déroulantes.
 *
 * Né d'un défaut réel (20/07) : les portails Radix rendaient hors du sous-arbre
 * `.dark`, donc en clair sur page sombre, sur TOUS les écrans du Design System.
 * Trois écrans avaient été « vérifiés en sombre » sans que ça sorte, parce que
 * `e2e-shot.mjs` photographie la page sans jamais rien déplier.
 *
 *   node scripts/e2e-modale.mjs --compte=admin --route=/dashboard/lots \
 *     --ouvrir="Ajouter un lot" --nom=lots-creation
 *
 * `--ouvrir` est une expression régulière sur le nom accessible du bouton
 * déclencheur. Plusieurs déclencheurs se séparent par « || ».
 *
 * ⚠️ Sous Git Bash, préfixer par `MSYS_NO_PATHCONV=1`.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const compte = args.compte ?? "admin";
const route = args.route ?? "/dashboard";
const nom = args.nom ?? compte;
const ouvrir = String(args.ouvrir ?? "").split("||").map((s) => s.trim()).filter(Boolean);
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);

if (ouvrir.length === 0) {
  console.error("--ouvrir=\"<nom accessible du déclencheur>\" est obligatoire");
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

mkdirSync(OUT, { recursive: true });

// Cf. `e2e-shot.mjs` : Chromium résout Supabase en DNS-over-HTTPS et échoue.
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const erreurs = [];
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", (e) => erreurs.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#email", { timeout: 30000 });
await page.fill("#email", `manuel.${compte}@sgfn.ci`);
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 40000 });
if (route !== "/dashboard") await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
await page.waitForTimeout(9000);

// C'est le mode sombre qui révèle les surfaces mal rattachées.
const bascule = page.locator('header button[aria-label*="ombre" i], header button[aria-label*="thème" i]').first();
await bascule.click();
await page.waitForTimeout(400);
await page.getByRole("menuitem", { name: "Sombre" }).click();
await page.waitForTimeout(1500);

const luminance = (rgb) => {
  const n = String(rgb).match(/\d+/g);
  if (!n) return null;
  const [r, g, b] = n.slice(0, 3).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

let echecs = 0;

for (const motif of ouvrir) {
  const declencheur = page.getByRole("button", { name: new RegExp(motif) }).first();
  if (!(await declencheur.count())) {
    console.log(`${motif.padEnd(34)} ⚠️ déclencheur introuvable`);
    echecs++;
    continue;
  }
  await declencheur.click();

  const surface = page.locator(
    '[data-slot="dialog-content"], [data-slot="dropdown-menu-content"], [data-slot="select-content"], [data-slot="sheet-content"]',
  ).first();
  try {
    await surface.waitFor({ timeout: 8000 });
  } catch {
    console.log(`${motif.padEnd(34)} ⚠️ rien ne s'est ouvert`);
    echecs++;
    continue;
  }
  await page.waitForTimeout(700);

  const info = await page.evaluate(() => {
    const el = document.querySelector(
      '[data-slot="dialog-content"], [data-slot="dropdown-menu-content"], [data-slot="select-content"], [data-slot="sheet-content"]',
    );
    const cs = getComputedStyle(el);
    const titre = el.querySelector('[data-slot="dialog-title"]');
    return {
      dansDark: Boolean(el.closest(".dark")),
      fond: cs.backgroundColor,
      texte: titre ? getComputedStyle(titre).color : cs.color,
      // Une surface plus haute que la fenêtre sans défilement propre est
      // inutilisable : on le signale plutôt que de le découvrir en production.
      deborde: el.scrollHeight > el.clientHeight + 1 && cs.overflowY === "visible",
    };
  });

  const fondOk = luminance(info.fond) < 90;
  const texteOk = luminance(info.texte) > 140;
  const ok = info.dansDark && fondOk && texteOk && !info.deborde;
  if (!ok) echecs++;

  const nomFichier = new URL(`${nom}-${motif.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, OUT);
  await page.screenshot({ path: nomFichier.pathname.replace(/^\//, "") });

  console.log(
    `${motif.padEnd(34)} dark=${String(info.dansDark).padEnd(5)} ` +
    `fond=${String(info.fond).padEnd(20)} texte=${String(info.texte).padEnd(20)} ` +
    `${ok ? "OK" : "⚠️ " + [!info.dansDark && "hors .dark", !fondOk && "fond clair", !texteOk && "texte sombre", info.deborde && "déborde"].filter(Boolean).join(", ")}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

console.log(`\nécran   : ${nom} (${route}, compte manuel.${compte})`);
console.log(`console : ${erreurs.length ? erreurs.slice(0, 6).join("\n          ") : "aucune erreur"}`);

await browser.close();
process.exit(echecs > 0 || erreurs.length > 0 ? 1 : 0);
