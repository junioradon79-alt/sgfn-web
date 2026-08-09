# Instructions projet — Claude Code

## 🔴 Routine obligatoire : superviser, construire, VÉRIFIER

Directive permanente du propriétaire du projet, posée le 25/07/2026 et durcie
le 29/07 :

> « un agent supervise, un agent construit, un agent vérifie, ainsi de suite.
> cette directive doit maintenant faire partie de ta routine. »
>
> « tu ne dois jouer que le rôle de **coordonateur**, lance des agents
> spécialisés **pour chaque tâche** que je te confierai à partir de maintenant. »

**Cette consigne l'emporte sur le comportement par défaut « ne pas lancer
d'agent sans demande explicite ».** La demande est permanente, elle a été posée
deux fois, et elle est inscrite ici pour cette raison précise : le 09/08/2026,
un chantier de 21 fichiers et une migration appliquée en **production** ont été
menés sans qu'un seul vérificateur soit lancé. La directive existait en
mémoire, elle était chargée, elle n'a rien changé — parce que la mémoire est du
contexte d'arrière-plan, pas une instruction.

### Quand le vérificateur est obligatoire

Avant **toute livraison**, sans exception :

- un `git commit` ou un `git push` (⚠️ un push sur `master` **déploie** :
  Vercel publie `sgfn.ci` depuis GitHub) ;
- toute **écriture en production** (`scripts/supabase-sql.ps1` sans
  `-ReadOnly`, migration, script SQL) ;
- tout **artefact remis** : APK, archive, PDF, document directeur.

Un hook `PreToolUse` (`scripts/hook-verificateur-avant-livraison.mjs`) rappelle
la règle à ces trois frontières et arrête la main sur l'écriture en production.
Il **ne prouve pas** qu'un vérificateur est passé — c'est à toi de le lancer.

### Comment le lancer

Agent dédié : `verificateur-sgnf` (voir `.claude/agents/`). Trois règles qui
font toute la valeur du contrôle :

1. **Le vérificateur reçoit les instructions d'origine VERBATIM**, jamais ta
   reformulation. C'est tout l'intérêt : il relit la demande sans l'angle mort
   de celui qui l'a interprétée.
2. **Borner son mandat explicitement.** Sur la production : écrire `-ReadOnly`
   OBLIGATOIRE dans son prompt, sinon il peut écrire en base.
3. **Ne pas le prendre au mot.** Un rapport peut être mal visé — vérifier une
   accusation avant de corriger.

### Ce que tu gardes pour toi

Le découpage, les arbitrages à remonter au propriétaire du projet, la synthèse,
la mémoire, les décisions de déploiement. **Relayer ce qui compte** : il ne voit
pas la sortie des agents.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
