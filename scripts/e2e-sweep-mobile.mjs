/**
 * Balayage mobile : sur un écran de téléphone, quels écrans débordent ?
 *
 *   node scripts/e2e-sweep-mobile.mjs                        # out/ servi en local
 *   E2E_BASE=https://sgfn.ci node scripts/e2e-sweep-mobile.mjs
 *
 * Le débordement horizontal est le défaut mobile qu'une capture ne montre
 * pas : la page paraît normale, seul le contenu poussé hors du cadre manque —
 * et sur un écran de 390 px c'est une colonne entière qui disparaît.
 *
 * Trois mesures par écran, parce qu'elles n'ont pas la même cause :
 *   - `deborde`  : le document est plus large que la fenêtre (contenu figé) ;
 *   - `barreFixe`: une barre latérale reste affichée sous `lg` (coquille non
 *                  responsive — c'est le cas de `/lotissements`) ;
 *   - `menu`     : le bouton d'ouverture du tiroir est-il présent ? Sans lui,
 *                  la navigation est inatteignable au doigt.
 */
import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3100";

const ROUTES = [
  "/dashboard", "/dashboard/carte", "/dashboard/lots", "/dashboard/ilots",
  "/dashboard/attributaires", "/dashboard/attributions", "/dashboard/documents",
  "/dashboard/paiements", "/dashboard/statistiques", "/dashboard/administration",
  "/dashboard/annonces", "/dashboard/litiges", "/dashboard/dossiers-adu",
  "/dashboard/invitations", "/dashboard/messages", "/dashboard/demarches",
  "/dashboard/validations", "/dashboard/concertation", "/dashboard/familles",
  "/dashboard/geometres", "/dashboard/consultations-qr", "/dashboard/saisie",
  "/dashboard/ia", "/dashboard/demandes-acquisition", "/dashboard/contacts-marketplace",
  "/lotissements",
];

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();

await page.goto(`${BASE}/login/`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("#email", { timeout: 20000 });
await page.fill("#email", "manuel.admin@sgfn.ci");
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 30000 });

const fautifs = [];
console.log(`viewport ${page.viewportSize().width}px — ${ROUTES.length} écrans\n`);

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}/`, { waitUntil: "domcontentloaded" }).catch(() => {});

  // Attendre la coquille, et non un délai fixe : la garde d'authentification
  // affiche « Vérification de la session… » pendant plusieurs secondes, et un
  // `waitForTimeout` trop court faisait conclure « pas de bouton menu » sur des
  // écrans parfaitement sains — le balayage inventait des défauts.
  await page
    .locator("header, aside")
    .first()
    .waitFor({ state: "visible", timeout: 25000 })
    .catch(() => {});
  await page
    .locator("text=Vérification de la session")
    .waitFor({ state: "detached", timeout: 25000 })
    .catch(() => {});
  await page.waitForTimeout(3000);

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    // Une barre latérale « en dur » : un <aside> visible et large sur mobile.
    const aside = [...document.querySelectorAll("aside")].find((a) => {
      const r = a.getBoundingClientRect();
      return r.width > 150 && r.height > 300 && getComputedStyle(a).display !== "none";
    });
    const menu = document.querySelector(
      'button[aria-label*="menu" i], button[aria-label*="navigation" i], header button svg.lucide-menu',
    );
    return {
      deborde: de.scrollWidth - de.clientWidth,
      barreFixe: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      menu: Boolean(menu),
    };
  });

  const ko = m.deborde > 0 || m.barreFixe > 0 || !m.menu;
  if (ko) fautifs.push({ route, ...m });
  console.log(
    `${ko ? "  KO  " : "  ok  "} ${route.padEnd(38)}` +
    `${m.deborde > 0 ? ` déborde de ${m.deborde}px` : ""}` +
    `${m.barreFixe > 0 ? ` · barre fixe ${m.barreFixe}px` : ""}` +
    `${m.menu ? "" : " · pas de bouton menu"}`,
  );
}

await browser.close();
console.log(fautifs.length ? `\n${fautifs.length} écran(s) à corriger.` : "\nAucun débordement.");
process.exit(fautifs.length ? 1 : 0);
