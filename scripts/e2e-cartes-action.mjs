/**
 * Contrôle des « cartes d'action » — celles qui virent au rouge brique quand
 * une file attend une décision (`Card tone="alert"` + pastilles compteur).
 *
 * Ce qu'une capture d'écran seule ne prouve pas, et que ce script vérifie :
 *  - que le jeton `--brick` existe **et** a été appliqué : une classe Tailwind
 *    inconnue ne produit aucune erreur, elle ne peint simplement rien. Seules
 *    les couleurs calculées (`getComputedStyle`) tranchent ;
 *  - que la teinte est bien **conditionnelle** : `data-tone` doit valoir
 *    `alert` file pleine et `default` file vide — une carte brique en
 *    permanence redevient un décor ;
 *  - que les pastilles portent un nombre lisible et ne s'ovalisent pas ;
 *  - que le contraste texte/fond du bandeau reste au-dessus de 4,5:1 en clair
 *    comme en sombre ;
 *  - qu'aucune carte ne déborde en 390 px.
 *
 *   MSYS_NO_PATHCONV=1 node scripts/e2e-cartes-action.mjs
 *
 * Par défaut le serveur local ; E2E_BASE pour viser ailleurs. Sorties dans
 * .shots/ (non suivi). Lecture seule : aucune écriture en base.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const OUT = new URL("../.shots/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const chemin = (s) => new URL(`cartes-${s}`, OUT).pathname.replace(/^\//, "");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

let ok = 0;
let ko = 0;
const verifier = (libelle, condition, detail = "") => {
  if (condition) {
    ok += 1;
    console.log(`  ✅ ${libelle}${detail ? ` — ${detail}` : ""}`);
  } else {
    ko += 1;
    console.log(`  ❌ ${libelle}${detail ? ` — ${detail}` : ""}`);
  }
};

/** Contraste WCAG entre deux couleurs `rgb(...)` calculées par le navigateur. */
function contraste(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const v = [r, g, bl].map((x) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Cf. mémoire projet « connectivite_dns_securise_chrome » : sans ces drapeaux,
// Chromium résout Supabase en DoH et l'écran se photographie vide.
const browser = await chromium.launch({
  args: ["--dns-over-https-mode=off", "--disable-features=DnsOverHttps"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

const erreurs = [];
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

console.log(`\n▶ Cartes d'action (rouge brique) — ${BASE}\n`);

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("#email", { timeout: 30000 });
await page.fill("#email", "manuel.admin@sgfn.ci");
await page.fill("#password", env.MANUEL_TEST_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 40000 });
await page.waitForTimeout(9000);

// ── 1. Le jeton existe et vaut bien le brique attendu ──
const brick = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--brick").trim(),
);
verifier("Jeton --brick défini", brick.toUpperCase() === "#B23A2E", brick || "(vide)");

// ── 2. Centre d'alertes : teinte conditionnelle ──
const carte = page.locator('[data-slot="card"]').filter({ hasText: "Actions requises" }).first();
await carte.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

const ton = await carte.getAttribute("data-tone");
const nbAlertes = await carte.locator('[data-slot="count-badge"]').count();
verifier(
  "data-tone cohérent avec la file",
  (nbAlertes > 0 && ton === "alert") || (nbAlertes === 0 && ton === "default"),
  `tone=${ton}, ${nbAlertes} pastille(s)`,
);

const mesure = await carte.evaluate((el) => {
  const cs = getComputedStyle;
  const header = el.querySelector('[data-slot="card-header"]');
  const titre = el.querySelector('[data-slot="card-title"]');
  return {
    carteFond: cs(el).backgroundColor,
    bandeauFond: header ? cs(header).backgroundColor : null,
    titreCouleur: titre ? cs(titre).color : null,
    pastilles: [...el.querySelectorAll('[data-slot="count-badge"]')].map((p) => {
      const r = p.getBoundingClientRect();
      return {
        texte: p.textContent.trim(),
        fond: cs(p).backgroundColor,
        couleur: cs(p).color,
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }),
  };
});

if (ton === "alert") {
  verifier(
    "Bandeau d'en-tête peint en brique",
    mesure.bandeauFond === "rgb(178, 58, 46)",
    mesure.bandeauFond,
  );
  const c = contraste(mesure.titreCouleur, mesure.bandeauFond);
  verifier("Titre lisible sur le bandeau (≥ 4,5:1)", c >= 4.5, `${c.toFixed(2)}:1`);
  verifier(
    "Pastilles rondes ou capsules, jamais écrasées",
    mesure.pastilles.every((p) => p.w >= 22 && p.h >= 20 && p.w <= 3 * p.h),
    mesure.pastilles.map((p) => `${p.texte}:${p.w}×${p.h}`).join(" "),
  );
  verifier(
    "Chaque pastille porte un nombre",
    mesure.pastilles.every((p) => /^\d+\+?$/.test(p.texte)),
    mesure.pastilles.map((p) => p.texte).join(", "),
  );
  const cp = contraste(mesure.pastilles[0].couleur, mesure.pastilles[0].fond);
  verifier("Chiffre lisible dans la pastille (≥ 4,5:1)", cp >= 4.5, `${cp.toFixed(2)}:1`);
} else {
  verifier("File vide : la carte reste neutre", mesure.bandeauFond !== "rgb(178, 58, 46)", mesure.bandeauFond);
}

await carte.screenshot({ path: chemin("alertes-clair.png") });
await page.screenshot({ path: chemin("dashboard-clair.png") });

// ── 3. Thème sombre : la teinte pleine ne bouge pas, le lavis bascule ──
await page.evaluate(() => document.documentElement.classList.add("dark"));
await page.waitForTimeout(500);
const sombre = await carte.evaluate((el) => {
  const cs = getComputedStyle;
  const header = el.querySelector('[data-slot="card-header"]');
  const titre = el.querySelector('[data-slot="card-title"]');
  return {
    carteFond: cs(el).backgroundColor,
    bandeauFond: header ? cs(header).backgroundColor : null,
    titreCouleur: titre ? cs(titre).color : null,
  };
});
if (ton === "alert") {
  verifier("Sombre : bandeau brique inchangé", sombre.bandeauFond === "rgb(178, 58, 46)", sombre.bandeauFond);
  verifier("Sombre : lavis de fond basculé", sombre.carteFond !== mesure.carteFond, sombre.carteFond);
  const c = contraste(sombre.titreCouleur, sombre.bandeauFond);
  verifier("Sombre : titre lisible (≥ 4,5:1)", c >= 4.5, `${c.toFixed(2)}:1`);
}
await carte.screenshot({ path: chemin("alertes-sombre.png") });
await page.evaluate(() => document.documentElement.classList.remove("dark"));
await page.waitForTimeout(300);

// ── 4. Aucun débordement, écran large puis téléphone ──
const deborde = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
verifier("Aucun débordement horizontal (1600 px)", !deborde);

// ⚠️ Ne PAS mesurer ici le débordement du document en 390 px : le Centre de
// pilotage en déborde de 9 px depuis longtemps (tuiles Leaflet de la carte +
// grille `min-w-[34rem]` des files de traitement), à l'identique en production.
// Un contrôle global attribuerait ce défaut ancien aux cartes d'action. On
// mesure donc la carte elle-même — le seul périmètre dont ce script répond.
await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(800);
await carte.scrollIntoViewIfNeeded();
await carte.screenshot({ path: chemin("alertes-390.png") });
const largeurCarte = await carte.evaluate((el) => Math.round(el.getBoundingClientRect().width));
verifier("La carte tient dans un écran de 390 px", largeurCarte <= 390, `${largeurCarte} px`);
await page.setViewportSize({ width: 1600, height: 1200 });

// ── 5. Les autres écrans porteurs du même signal ──
// Compte le brique effectivement peint : c'est zéro tant que les files sont
// vides, et c'est le comportement attendu. Pour VOIR l'état plein sans rien
// écrire en base, ouvrir /apercu-cartes (développement uniquement).
for (const [nom, url, attendu] of [
  ["demandes-acquisition", "/dashboard/demandes-acquisition", "Demandes d'acquisition"],
  // Écran de chefferie : un compte admin y reçoit « Accès réservé ». On vérifie
  // que la garde tient, pas la carte — celle-ci se contrôle sur /apercu-cartes.
  ["validations", "/dashboard/validations", "Accès réservé"],
]) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  const corps = await page.locator("main").innerText();
  verifier(`Écran ${nom} : contenu attendu`, corps.includes(attendu), corps.slice(0, 60).replace(/\n/g, " · "));
  const briques = await page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter(
        (el) => getComputedStyle(el).backgroundColor === "rgb(178, 58, 46)",
      ).length,
  );
  console.log(`     ↳ ${briques} élément(s) en aplat brique (0 attendu si la file est vide)`);
  await page.screenshot({ path: chemin(`${nom}.png`), fullPage: true });
}

// ── 5 bis. L'état « file pleine », sur la page d'aperçu ──
// C'est le seul endroit où l'on peut prouver la teinte sans fabriquer de
// dossiers en base. Absente d'un build de production : on n'échoue pas dessus.
await page.goto(`${BASE}/apercu-cartes/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const apercu = await page.evaluate(() => {
  const cartes = [...document.querySelectorAll('[data-slot="card"]')];
  return {
    total: cartes.length,
    alertes: cartes.filter((c) => c.dataset.tone === "alert").length,
    neutres: cartes.filter((c) => c.dataset.tone === "default").length,
    bandeaux: cartes.filter((c) => {
      const h = c.querySelector('[data-slot="card-header"]');
      return h && getComputedStyle(h).backgroundColor === "rgb(178, 58, 46)";
    }).length,
  };
});
if (apercu.total > 0) {
  verifier(
    "Aperçu : chaque carte en alerte porte son bandeau brique",
    apercu.alertes > 0 && apercu.bandeaux === apercu.alertes,
    `${apercu.alertes} en alerte, ${apercu.neutres} neutres, ${apercu.bandeaux} bandeaux peints`,
  );
  verifier("Aperçu : les deux états coexistent", apercu.neutres > 0, `${apercu.neutres} carte(s) neutre(s)`);
  await page.screenshot({ path: chemin("apercu.png"), fullPage: true });
} else {
  console.log("  ⏭️  /apercu-cartes indisponible (build de production) — contrôle ignoré");
}

// ── 6. Console ──
const bruit = erreurs.filter((e) => !/favicon|Download the React DevTools|Fast Refresh/i.test(e));
verifier("Aucune erreur console", bruit.length === 0, bruit.slice(0, 3).join(" | "));

await browser.close();

console.log(`\n${ko === 0 ? "✅" : "❌"} ${ok}/${ok + ko} contrôles passés — captures dans .shots/\n`);
process.exit(ko === 0 ? 0 : 1);
