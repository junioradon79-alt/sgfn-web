import { chromium } from "playwright";

const BASE_URL = "https://sgfn.ci";
const PASSWORD = process.env.MANUEL_TEST_PASSWORD;
if (!PASSWORD) {
  console.error("Variable d'environnement MANUEL_TEST_PASSWORD manquante.");
  process.exit(1);
}

const ALL_ACCOUNTS = [
  { code: "SGFN-8CD77WME", email: "manuel.admin@sgfn.ci", nom: "Compte Test — Admin" },
  { code: "SGFN-VVEYQFPS", email: "manuel.operateur@sgfn.ci", nom: "Compte Test — Opérateur" },
  { code: "SGFN-WQKG2VQ7", email: "manuel.proprietaire@sgfn.ci", nom: "Compte Test — Propriétaire" },
  { code: "SGFN-WA9XXGZS", email: "manuel.commissaire@sgfn.ci", nom: "Compte Test — Commissaire" },
  { code: "SGFN-WEMTSLJ", email: "manuel.geometre@sgfn.ci", nom: "Compte Test — Géomètre" },
  { code: "SGFN-7VUPYTF6", email: "manuel.chefferie@sgfn.ci", nom: "Compte Test — Chefferie" },
  { code: "SGFN-9DN2BP5D", email: "manuel.amenageur@sgfn.ci", nom: "Compte Test — Aménageur" },
  { code: "SGFN-RPXWUE3M", email: "manuel.verificateur@sgfn.ci", nom: "Compte Test — Vérificateur" },
];

// Le compte admin a déjà été créé avec succès lors du premier passage.
const SKIP_EMAILS = new Set(["manuel.admin@sgfn.ci"]);
const ACCOUNTS = ALL_ACCOUNTS.filter((a) => !SKIP_EMAILS.has(a.email));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];

const browser = await chromium.launch();

for (const acc of ACCOUNTS) {
  const page = await browser.newPage();
  try {
    await page.goto(`${BASE_URL}/inscription`, { waitUntil: "networkidle" });
    await page.fill("#code", acc.code);
    await page.click('button[type="submit"]');
    await page.waitForSelector("#nom", { timeout: 15000 });

    await page.fill("#nom", acc.nom);
    await page.fill("#telephone", "+225 07 00 00 00 00");
    await page.fill("#email", acc.email);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');

    // Soit redirection /dashboard (session immédiate), soit écran "Compte créé !", soit message d'erreur visible
    const outcome = await Promise.race([
      page.waitForURL("**/dashboard**", { timeout: 25000 }).then(() => "dashboard"),
      page.waitForSelector("text=Compte créé", { timeout: 25000 }).then(() => "success"),
      page
        .waitForSelector("form p.text-red-600", { timeout: 25000 })
        .then((el) => el.textContent())
        .then((msg) => `error:${msg}`),
    ]);

    if (outcome.startsWith("error:")) {
      throw new Error(outcome.slice(6));
    }

    const finalUrl = page.url();
    const immediate = finalUrl.includes("/dashboard");
    results.push({ ...acc, status: "ok", immediate, outcome });
    console.log(`[OK] ${acc.email} — ${outcome} (session immédiate: ${immediate})`);
  } catch (err) {
    results.push({ ...acc, status: "error", error: String(err.message ?? err) });
    console.error(`[ERREUR] ${acc.email}:`, err.message ?? err);
  } finally {
    await page.close();
  }
  // Espacer les inscriptions pour éviter le rate-limit Supabase Auth
  await sleep(8000);
}

await browser.close();

console.log("\n--- Résumé ---");
console.table(results.map(({ code, email, status, immediate }) => ({ code, email, status, immediate })));

const failed = results.filter((r) => r.status !== "ok");
if (failed.length > 0) {
  console.error(`\n${failed.length} compte(s) en échec.`);
  process.exit(1);
}
