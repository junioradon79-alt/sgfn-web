# SGNF – Base de données (Supabase)

**Version :** 1.0
**Date de rédaction :** 04 juillet 2026
**Statut :** Document de référence — dossier de passation développeur

---

# 1. Projet Supabase

- Référence projet : `bvdzrhvbiglwrhzpmuwy`
- Région : `eu-west-3` (Paris)
- Partagé par `sgfn-web` ET `monterrain-web` — un seul backend pour les deux façades.
- **RLS (Row Level Security) activé sur 100 % des tables** — c'est le principal mécanisme de sécurité de toute l'application (voir [03-ARCHITECTURE.md](03-ARCHITECTURE.md) §3 : l'export statique rend toute protection côté serveur/middleware inopérante).
- `database.types.ts` (racine de `sgfn-web`) : types TypeScript générés depuis le schéma réel — **à régénérer via le MCP Supabase (`generate_typescript_types`) après tout changement de schéma/fonction**, sinon les appels `supabase.rpc()`/`.from()` ne type-checkent plus.
- ⚠️ Le dossier `supabase/functions/` **n'existe pas en local** — les edge functions ne sont versionnées nulle part dans le repo, uniquement dans le cloud Supabase (gérées via MCP).

---

# 2. Tables par domaine (snapshot du 04/07/2026, ~46 tables)

## Référentiel foncier

`lotissements` (2), `ilots` (102), `lots` (898), `attributaires` (57), `attributions` (1360), `operateurs`, `geometres_experts`, `commissaires_justice`, `cvgfr`. *(Volumétries relues en production le 10/08/2026 ; les valeurs précédentes — 895 / 39 / 68 — dataient de la mise en place et étaient fortement périmées.)*

🔴 **`attributions.rang` — convention, depuis le 10/08/2026 (migration `20260809110000`).** Position dans la **chaîne de détention** du lot, en **base 1** : le rang 1 est le détenteur d'origine, le rang le plus élevé est le titulaire actuel et porte `actuel = true`. Sans trou ni doublon — garanti par `attributions_lot_rang_uniq` (unique sur `lot_id, rang`) et `attributions_lot_actuel_uniq` (unique sur `lot_id where actuel`). Toute écriture suit `coalesce(max(rang), 0) + 1`.
Ce n'est pas cosmétique : 441 chaînes commençaient auparavant au rang **0** et 11 portaient deux lignes au même rang, ce qui rendait faux tout calcul supposant un point de départ fixe. Les vues `v_attestations_gratuites_manquantes` et `v_attestations_bloquees_documents` filtrent sur `rang = 1 AND actuel` : **ce prédicat ne signifie « jamais transféré » que sous cette convention**. Ne pas réintroduire de rang 0.

🔴 **Le rang n'est PAS le palier tarifaire.** `rang` compte les changements de détenteur ; le prix d'une attestation dépend du nombre d'**actes délivrés**. Les deux divergeaient sur **854 lots sur 871**. Le palier se lit désormais par `palier_attestation_du_lot(lot_id)` = 1 + les actes non révoqués de `attestations_cession` **et** `attestations_attribution_lot` — 1 = gratuite, 2 = forfait national (30 000), 3+ = tarif chefferie. `creer_cession` et `facturer_attestation_cession` l'appellent toutes deux ; elles portaient auparavant deux lectures divergentes de `rang`. La fonction est fermée à `anon` **et** à `authenticated` : ses seuls appelants sont `SECURITY DEFINER`.

## Hiérarchie familiale / coutumière

`grandes_familles`, `familles` (23, avec `chef_profile_id` FK → profiles = identité routable du chef de famille), `autorites_coutumieres` (26 lignes au 24/07 — 25 chefferies d'Abidjan/Songon-Anyama-Bingerville ajoutées, `numero_arrete_nomination`/`date_arrete`/`autorite_signataire`/`arrete_nomination_scan_url` laissés `null` tant qu'aucun arrêté réel n'est saisi), `pv_reunions_famille` (13) + `pv_reunions_famille_lots` (21) + `pv_reunions_famille_membres` (16), `attestations_coutumieres` (APFC, 1 ligne).

## Référentiel géographique

`sous_prefectures` (créée le 24/07, 252 lignes couvrant tout le territoire ivoirien, source Ministère de l'Intérieur via data.gouv.ci) — `nom`, `departement`, `region`, `chef_lieu_departement`, `commune` (198/252 avec commune de plein exercice). **Distincte de `autorites_coutumieres`** : une sous-préfecture est une circonscription d'État, pas une autorité traditionnelle. ⚠️ `region` reprend l'ancienne nomenclature ministérielle à 19 régions (ex. « Lagunes »), pas les 14 districts/31 régions actuels — ne pas les confondre. RLS : lecture pour tout authentifié, écriture admin seule.

## Documents & transactions foncières

`attestations_cession` (19), `certificats_vente`, `cessions` (3), `documents` (108), `dossiers_adu`, `constats`, `transactions`/`transaction_parties` (0, non utilisées).

## Ventes & paiements

`ventes`, `echeances`, `paiements`, `demarches`, `grille_commissions` (grille par type de paiement/tranche — ne s'applique jamais à `vente_terrain`, commission=0 décision métier), `parametres_paiement` (seuil de validation manuelle, actuellement 1 000 000 FCFA, configurable sans redéploiement).

⚠️ Toutes ces tables étaient **à 0 ligne** avant la session de test du 02-03/07/2026 (voir [02-ROADMAP.md](02-ROADMAP.md)) — le module paiements n'avait jamais été exercé avec de vraies données avant cette date-là.

## Marketplace « Mon Terrain »

`jetons_marketplace` (pass 5000 FCFA/7j/10 contacts), `annonces_marketplace` (1 lot ↔ 1 annonce, statut `brouillon/active/suspendue/vendue`), `demandes_contact`. Vue publique `annonces_publiques` (`security_invoker=false`, colonnes `lat_approx`/`lng_approx` arrondies ~110 m, jamais les coordonnées exactes).

## Back-office interne (comptabilité + RH, créées le 24/07)

`depenses` (dépenses saisies à la main par catégorie — `categorie_depense` enum), `apports` (entrées manuelles hors commissions — apports en capital/prêts associés/subventions, `categorie_apport` enum, ajoutée en fin de journée le 24/07) et `collaborateurs` (annuaire RH simple). Usage interne SGNF uniquement, RLS admin + rôle `comptable` (valeur de l'enum `groupe_utilisateur`). Les recettes ne sont pas stockées ici : lues directement dans `paiements.commission_sgfn` (statut `confirme`), la part réellement encaissée par SGNF. Les apports sont volontairement tenus hors du KPI Recettes mais comptent dans le solde de trésorerie.

`collaborateurs` peut désormais porter un compte de connexion : `profiles.collaborateur_id` (FK, même convention que `famille_id`/`autorite_coutumiere_id` — portée par `profiles`, unique partiel) rattache un profil à sa fiche RH, provisionné via le système d'invitation existant (`invitations.collaborateur_id`). Rôle minimal `collaborateur` (valeur de l'enum, 24/07) : lecture seule de sa propre fiche (policy `collaborateurs_lecture_soi`) + Messages, rien d'autre.

## Litiges, messagerie, notifications, sécurité

`litiges`, `conversations`/`conversation_participants`/`messages`/`conversation_documents`, `notifications_a_envoyer` (file d'attente email/SMS), `invitations` (8), `scans_qr` (10 — journal des vérifications QR), `consultations_qr` (créée le 07/07 — consultations QR payantes des attestations de cession : 60 000 FCFA dont 50 000 chefferie/10 000 SGNF historisés par ligne, jeton porteur + code court `CQR-…`, RLS admin-only, écrite par les edge fns en service_role), `journal_audit` (1308 — trigger d'audit sur ~10 tables), `propositions_ia`, `profiles` (14).

---

# 3. Fonctions et triggers clés

**Helpers RLS** (SECURITY DEFINER, appelés à l'intérieur même des policies — **ne jamais révoquer leur EXECUTE**, ça casserait l'accès aux données) : `est_admin()`, `est_comptable()` (rôle `comptable`, 24/07), `mon_collaborateur_id()` (rôle `collaborateur`, 24/07), `mon_groupe()`, `mon_attributaire_id()`, `mon_operateur_id()`, `peut_contacter()`, `suis_participant()`. À part, `collaborateurs_avec_compte()` (24/07) : pas un helper de policy mais un RPC appelé par le front (pages Invitations/Collaborateurs) pour savoir quels collaborateurs ont déjà un compte, sans exposer toute la table `profiles` à `comptable` — le filtre `est_admin() OR est_comptable()` est fait **dans** la fonction, un appel non autorisé renvoie un ensemble vide plutôt qu'une erreur.

**Triggers d'audit et de cohérence** : `enregistrer_audit()` (journalise sur `journal_audit`, doit être `SECURITY DEFINER` — bug corrigé le 02/07, voir §5), `bloquer_double_cession`, `verrouiller_lot_vendu`, `ventes_before_insert`/`ventes_after_insert` (verrouille le lot + génère le certificat), `set_updated_at()`.

**Saisie du registre (maker-checker)** : `soumettre_saisie` (RPC, dépose dans `soumissions_saisie` — **seul chemin d'écriture** pour qui n'est pas admin ; sa liste blanche de types est dans le corps de la fonction, la contrainte `soumissions_saisie_type_check` doit être élargie **en même temps**, sans quoi l'INSERT est rejeté après acceptation), `approuver_soumission` / `rejeter_soumission`, et les fonctions d'application `_appliquer_maj_attributions`, `_appliquer_creation_structure`, `_appliquer_creation_lotissement`, `_appliquer_modification_lotissement`, `_appliquer_maj_attributaire`.

- 🔴 **Garde par rôle de `soumettre_saisie`** — `maj_attributions` / `creation_structure` / `maj_attributaire` : **admin ou `operateur_saisie`** ; `creation_lotissement` / `modification_lotissement` : **admin ou `chefferie`**. Pour une chefferie, la fonction **force** `autorite_coutumiere_id` à `ma_chefferie_id()` (inutile de l'envoyer) et refuse toute modification d'un lotissement hors juridiction. Cette répartition est dupliquée côté mobile dans `src/features/mobile/roles.ts` (`SAISIES_PAR_ROLE`), qui doit en rester le **miroir exact** : proposer un formulaire que la fonction refuse fait remplir une fiche entière pour rien.
- ⚠️ **`lotissements` est lisible PUBLIQUEMENT** (`lotissements_public_read`, `qual = true` — la vitrine s'en sert). Une chefferie voit donc **tous** les lotissements alors qu'elle ne peut soumettre que sur les siens : tout écran de sélection doit filtrer sur `ma_chefferie_id()` de lui-même. Ce filtre est un confort d'affichage, **pas** une sécurité — `soumettre_saisie` tranche en dernier ressort.
- 🔴 **Gel juridique (27/07)** : `_appliquer_maj_attributions` **refuse** toute opération sur un lot dont `lots.verrouille` est vrai (`Lot X sous gel juridique : opération refusée`). Le refus est levé **dans la boucle** des opérations — un seul lot gelé fait donc échouer la soumission entière, d'où le contrôle en amont côté écrans et import Excel.
- ⚠️ **`_appliquer_modification_lotissement` remet à `NULL` tout champ absent du payload** (seul `nom` est protégé) : un payload partiel **vide la fiche**. Les appelants doivent renvoyer la fiche entière. Défaut connu, non corrigé — il concerne aussi le flux chefferie du web.
- ⚠️ **`_appliquer_maj_attributaire` suit la convention inverse** : clé **absente** = valeur inchangée, clé **présente à `null`** = effacement (`p_payload ? 'champ'`). Les deux conventions coexistent, ne pas les confondre.

**Paiements** : `traiter_paiement_confirme()` (déclenche génération d'attestation/quittance à la confirmation), `marquer_paiement_recu` (RPC, bascule auto/validation manuelle selon `parametres_paiement`), `valider_paiement_manuel` (RPC), `generer_reference_quittance()` (trigger BEFORE, séquence `QUIT-AAAA-NNNNN`), `paiements_trigger_generation()` (appelle l'edge fn `generation-document`), `paiements_notifier_payeur()` (file une notification email).

**QR / vérification publique** : `generer_qr_token()` (jeton hex 16 octets auto sur `attestations_cession`/`certificats_vente`), `verifier_document()` (RPC unifiée utilisée par l'edge fn `verification-qr`), `detecter_clone_qr()` (alerte si ≥5 IP distinctes/24h ou 2 scans >100 km à <1h, dédupliquée 1×/référence/24h).

**Suivi de parcelle (captage de leads)** : `suivre_parcelle(p_reference)` (depuis l'invite de `/verifier` après un scan QR) et **`mes_suivis()`** — RPC `SECURITY DEFINER` qui joint lot/îlot/lotissement et l'annonce active du marketplace (`en_vente`, `annonce_id`), scopée à `auth.uid()`. Table `suivis_parcelle` (unique `profile_id + lot_id`, suppression scopée au propriétaire).

🔴 **Piège** : parce que `mes_suivis()` est `SECURITY DEFINER`, elle renvoie des libellés de lots que l'appelant **n'a pas le droit de lire lui-même**. Un acquéreur ne peut lire `lots` que via `lots_marketplace_public_read`, c'est-à-dire **uniquement si le lot porte une annonce active** — il n'a aucune attribution et n'entre dans aucune branche de `lots_read_scope`. Toute navigation construite depuis ces résultats (ouvrir le détail d'une parcelle suivie) tombe donc sur un écran vide dès que le terrain n'est pas en vente. Vérifier les policies de la table cible, jamais la sortie de la fonction.

**Marketplace** : `est_lot_eligible_marketplace(lot_id)` (éligibilité = attestation ou certificat au statut `delivree`), `tg_demande_contact_valide_jeton` (décompte le jeton), `tg_paiement_active_jeton` (active le jeton à la confirmation du paiement pass).

**Routage / interet** : `manifester_interet(p_lot_id, p_message)` (crée conversation + participants, route vers opérateur/chef de famille/admins), `mon_operateur_id()`, RPC de reporting `disponibilites_foncieres`/`conformite_lotissements`.

**Infrastructure** : `sgfn_call_edge()` (appelle une edge function depuis un trigger/cron Postgres via `pg_net`) — **`pg_net` reste volontairement dans le schéma `public`** malgré l'avertissement Supabase advisor, car le déplacer casserait ces appels sans réécriture complète des `search_path`.

---

# 4. État de l'audit sécurité/RLS (au 03/07/2026)

Audit complet mené en plusieurs lots depuis le 29/06/2026 :

- **Lots A+B** (appliqués) : 88 index créés sur FK sans index, `search_path` figé sur les fonctions sensibles.
- **Lot C** (appliqué) : 20 policies RLS optimisées (`auth.uid()` → `(select auth.uid())`, InitPlan).
- **Lot D + D-bis** (appliqués) : vues passées en `security_invoker`, EXECUTE révoqué sur triggers et fonctions internes non destinées à être appelées directement.
- **Résultat actuel** : advisors Supabase = **0 erreur**, uniquement des WARN intentionnels (helpers RLS accessibles à `authenticated`/`anon` par nécessité, `pg_net` en public, fonctions publiques volontaires comme `valider_invitation`/`verifier_document`).

**Backlog non traité (à faire dans une passe dédiée, avec tests)** :

- **E** — ~165 `multiple_permissive_policies` : vrai refactor RLS pour consolider les policies permissives multiples par rôle/action.
- **F** — activer la protection mots de passe compromis (Dashboard Supabase → Auth → Settings, pas du SQL) + sortir une extension du schéma `public`.
- **G** — ~75 index inutilisés à examiner au cas par cas avant suppression (beaucoup sont les nouveaux index FK du lot A/B, pas encore « touchés » par une requête — **ne pas les supprimer sur ce seul critère**).

---

# 5. Bugs de production corrigés en base (historique, pour référence)

Ces corrections ont été appliquées directement en base (migrations Supabase), sans commit git associé côté application :

1. **`enregistrer_audit()` non `SECURITY DEFINER`** — tout insert/update/delete via un compte non-service-role échouait (`new row violates row-level security policy for table "journal_audit"`). Resté invisible longtemps car toutes les données de test précédentes avaient été insérées en direct par service_role. Corrigé (migration `fix_enregistrer_audit_security_definer`).
2. **`traiter_paiement_confirme()` ne comptait que les échéances** — une vente comptant (sans échéance) restait bloquée à `montant_paye=0` malgré un paiement confirmé en totalité. Corrigé pour additionner aussi les paiements confirmés directs (migration `fix_traiter_paiement_confirme_ventes_comptant`).
3. **`acheter-pass-marketplace` insérait `moyen:'mobile_money'`** (valeur inexistante dans l'enum `moyen_paiement`) et **`montant_reverse:0`** sur une colonne générée (insert interdit) — corrigés avant mise en prod (v3 de l'edge fn).

---

# 6. Voir aussi

- [03-ARCHITECTURE.md](03-ARCHITECTURE.md) — pourquoi le RLS est le seul rempart de sécurité (contrainte d'export statique).
- [02-ROADMAP.md](02-ROADMAP.md) — grille tarifaire (`Grille_Tarifaire_SGNF_2026-07-03.md`), tarifs pas encore en base (aucune table `tarifs` n'existe, tout est saisi manuellement).
