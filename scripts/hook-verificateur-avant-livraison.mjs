#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  HOOK PreToolUse — la routine « un vérificateur tiers avant toute livraison »
//  cesse de dépendre du jugement de l'assistant.
//
//  POURQUOI CE FICHIER EXISTE
//
//  La directive du propriétaire du projet (25/07/2026, durcie le 29/07) dit :
//  « un agent supervise, un agent construit, un agent vérifie » et « aucun
//  artefact livré sans passage par le vérificateur ». Elle ne vivait que dans
//  la mémoire de l'assistant — c'est-à-dire dans du contexte d'arrière-plan,
//  explicitement présenté comme n'étant PAS une instruction. Le 09/08/2026,
//  un chantier entier (21 fichiers + une migration appliquée en production) a
//  été mené sans qu'un seul vérificateur soit lancé. La directive existait,
//  elle était chargée, et elle n'a rien changé.
//
//  Un hook, lui, est exécuté par le harnais. Il ne dépend d'aucune
//  interprétation, d'aucune mémoire, et d'aucun arbitrage de l'assistant.
//
//  DEUX RÉGIMES, VOLONTAIREMENT DIFFÉRENTS
//
//   1. ÉCRITURE EN PRODUCTION (`supabase-sql.ps1` sans `-ReadOnly`) → "ask".
//      Le harnais rend la main à l'humain. C'est rare, c'est irréversible, et
//      ça mérite un arrêt franc. Le précédent qui le justifie : la migration
//      du 08/08 a été appliquée en prod le 09/08 sans contrôle tiers.
//
//   2. COMMIT / PUSH → contexte injecté, SANS blocage.
//      Un « ask » à chaque commit rendrait le dépôt inutilisable et
//      reporterait sur l'humain la charge qu'on cherche justement à lui
//      retirer. Le rappel est donc injecté dans le contexte de l'assistant,
//      au moment précis de la livraison — là où il pèse autant que le défaut
//      inverse (« ne pas lancer d'agent sauf demande »).
//
//  🔴 CE QUE CE HOOK NE FAIT PAS, ET NE PEUT PAS FAIRE
//  Il ne PROUVE pas qu'un vérificateur est passé. Il n'a aucun moyen fiable de
//  le savoir : un fichier sentinelle serait trivialement contournable et
//  mentirait au premier faux positif. Il rappelle la règle à l'instant utile
//  et arrête la main sur ce qui est irréversible. Prétendre davantage serait
//  exactement le genre de faux vert que la directive combat.
// ═══════════════════════════════════════════════════════════════════════════

let brut = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (brut += c));
process.stdin.on("end", () => {
  let commande = "";
  try {
    const entree = JSON.parse(brut || "{}");
    commande = entree?.tool_input?.command ?? "";
  } catch {
    // Une entrée illisible ne doit JAMAIS bloquer un outil : le hook se tait.
    process.exit(0);
  }

  if (!commande) process.exit(0);

  // ── 1. Écriture en production ────────────────────────────────────────────
  // `-ReadOnly` peut être écrit dans n'importe quelle casse par PowerShell.
  const toucheLaProd = /supabase-sql\.ps1/i.test(commande);
  const enLectureSeule = /-ReadOnly\b/i.test(commande);

  if (toucheLaProd && !enLectureSeule) {
    rendre({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          "ÉCRITURE EN PRODUCTION SGNF — la routine du 25/07 exige qu'un vérificateur tiers " +
          "(mandat borné, -ReadOnly obligatoire) soit passé AVANT. Si ce n'est pas le cas, " +
          "refuse et fais-le lancer. Rappel : ce script pilote ses propres transactions, " +
          "la sûreté ne vient donc pas de -ReadOnly mais des assertions du fichier.",
      },
      systemMessage: "🔴 Écriture en production interceptée — vérificateur tiers passé ?",
    });
  }

  // ── 2. Livraison au dépôt ────────────────────────────────────────────────
  // `git commit --dry-run` ne livre rien : on ne l'intercepte pas.
  const commit = /\bgit\b[^\n]*\bcommit\b/.test(commande) && !/--dry-run\b/.test(commande);
  const push = /\bgit\b[^\n]*\bpush\b/.test(commande);

  if (commit || push) {
    const quoi = push
      ? "UN PUSH DÉCLENCHE UN DÉPLOIEMENT : Vercel publie sgfn.ci depuis GitHub. C'est une livraison au public."
      : "Un commit fixe le travail au dépôt.";
    rendre({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          `🔴 ROUTINE SGNF — VÉRIFICATEUR TIERS. ${quoi}\n` +
          "La directive permanente du propriétaire du projet (25/07/2026, durcie le 29/07) : " +
          "« un agent supervise, un agent construit, un agent vérifie » et « aucun artefact " +
          "livré sans passage par le vérificateur ».\n" +
          "Si aucun agent n'a contrôlé ce qui part maintenant — contre les instructions " +
          "D'ORIGINE, pas contre ta reformulation — lance-le AVANT de poursuivre. " +
          "Cette consigne l'emporte ici sur le défaut « ne pas lancer d'agent sans demande » : " +
          "la demande est permanente et a été posée deux fois.\n" +
          "Si un vérificateur est bien passé, poursuis sans commenter ce rappel.",
      },
    });
  }

  process.exit(0);
});

function rendre(charge) {
  process.stdout.write(JSON.stringify(charge));
  process.exit(0);
}
