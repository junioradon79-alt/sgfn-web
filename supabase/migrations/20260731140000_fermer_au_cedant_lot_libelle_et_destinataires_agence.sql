-- ============================================================================
-- Le cédant ne doit plus obtenir d'informations sur le bien cédé — 2 surfaces
-- ============================================================================
--
-- Seconde phrase de l'instruction du propriétaire du 29/07/2026 : « en cas de
-- changement de propriété, le cédant ne doit plus pouvoir obtenir des
-- informations sur le bien cédé. » Le lot `479bbb0` en avait traité quatre
-- surfaces (S1 à S4) ; un vérificateur tiers a relevé qu'il en restait quatre
-- autres, toutes `SECURITY DEFINER` et `grant execute … to authenticated`
-- SANS AUCUNE GARDE dans le corps.
--
-- MESURE AVANT (31/07/2026, emprunt de rôle, UNE TRANSACTION PAR IDENTITÉ,
-- témoin `auth.uid()` relevé DANS la transaction), sur le lot cédé par
-- AKE AMAFIN NICODEME — Lot 49 / Îlot 10 / Koelea-Accor revu
-- (`2aac99cb-cf87-4b62-af6a-145cb5d2c57f`) :
--
--   identité                    lot_libelle              destinataires_agence_lot
--   --------------------------  -----------------------  ------------------------
--   CÉDANT AKE     6155d411…    Lot 49 · Îlot 10 + lieu   6 profils
--   chefferie      e7091e37…    idem                      6
--   opérateur      9609aa8b…    idem                      6
--   opérateur NON  883ad4ff…    idem                      6      <-- aucun
--     rattaché                                                       rattachement
--   admin          2e668dcf…    idem                      6
--
-- Le compte `883ad4ff` n'a NI `operateur_id`, NI `famille_id`, NI juridiction,
-- et n'est pas admin : `est_admin()`, `mes_lot_ids()`, `lot_ids_chefferie()` et
-- `lot_ids_operateur()` sont tous faux/vides pour lui. Il lisait quand même le
-- libellé du lot et SIX identifiants de profils. Ces deux fonctions n'étaient
-- donc pas « trop larges » : elles étaient OUVERTES À TOUT COMPTE CONNECTÉ.
--
-- ---------------------------------------------------------------------------
-- POURQUOI RÉVOQUER, ET NON AJOUTER UNE GARDE DANS LE CORPS
-- ---------------------------------------------------------------------------
--
-- Le modèle du dépôt est `registre_supervision()` : `raise … using errcode =
-- '42501'` plus un `where` redondant. Il ne s'applique PAS ici, et le suivre
-- aurait cassé des écritures en production.
--
-- Ces deux fonctions sont appelées DEPUIS LA BASE, par cinq fonctions de
-- déclencheur `SECURITY DEFINER` appartenant à `postgres` (relevé dans
-- `pg_proc.prosrc`) :
--
--   lot_libelle              <- notif_annonce_active_suivis, notif_attestation_cession,
--                               notif_certificat_vente, notif_demande_acquisition,
--                               notif_vente
--   destinataires_agence_lot <- notif_certificat_vente, notif_demande_acquisition
--
-- Une garde ancrée sur `auth.uid()` se serait déclenchée AUSSI dans ces
-- déclencheurs : `SECURITY DEFINER` change `current_user`, jamais `auth.uid()`,
-- qui vient de la revendication JWT de la session. Un acquéreur déposant une
-- demande d'acquisition sur un lot dont il n'est pas titulaire — c'est la
-- définition même d'un prospect — aurait déclenché `notif_demande_acquisition`,
-- donc `lot_libelle`, donc `42501`.
--
-- 🔴 RECTIFICATION DU 31/07/2026 (vérificateur tiers, mesure à l'appui). La
-- première rédaction de ce paragraphe concluait que « son INSERT aurait été
-- ANNULÉ ». C'EST FAUX. Les cinq fonctions `notif_*` enveloppent leur appel
-- dans un bloc `begin … exception when others then null; end;` — relevé dans
-- `pg_proc.prosrc` des cinq, en production. Exemple, `notif_demande_acquisition` :
--
--     begin
--       v_info := public.lot_libelle(new.lot_id);
--       for v_prof in select * from public.destinataires_agence_lot(new.lot_id) loop
--         perform public.enqueue_notification(...);
--       end loop;
--     exception when others then null;
--     end;
--
-- Un `42501` levé là-dedans aurait donc été AVALÉ EN SILENCE : l'INSERT aurait
-- ABOUTI, et c'est la NOTIFICATION qui aurait disparu — sans erreur, sans trace.
-- La décision de révoquer reste la bonne (voir ci-dessous) ; c'est son motif qui
-- était mal formulé. Le risque réel d'une garde n'était pas une écriture perdue,
-- mais une notification perdue sans que personne ne l'apprenne.
--
-- ⚠️ COROLLAIRE, INDÉPENDANT DE CE LOT ET PLUS LARGE QUE LUI : ce chemin de
-- notification est INTÉGRALEMENT SILENCIEUX EN CAS D'ÉCHEC. Quelle qu'en soit la
-- cause — privilège, fonction absente, `enqueue_notification` en erreur —, les
-- cinq déclencheurs `notif_*` échoueront sans lever, sans journaliser, et sans
-- que l'écriture porteuse s'en aperçoive. Le jour où une notification cessera de
-- partir, RIEN NE LE SIGNALERA.
--
-- La révocation, elle, ne les touche pas : dans une fonction `SECURITY
-- DEFINER`, le privilège d'exécution est vérifié contre le PROPRIÉTAIRE
-- (`postgres`), qui conserve son `EXECUTE`. C'est le même dispositif que la
-- révocation de `verifier_document` la nuit dernière, restée sans dommage.
--
-- ---------------------------------------------------------------------------
-- POURQUOI AUCUN ÉCRAN NE CASSE
-- ---------------------------------------------------------------------------
--
-- Recherche des appelants dans `src/` à `HEAD` **et** dans le front RÉELLEMENT
-- DÉPLOYÉ (`1d65c53`, 25/07, à 68 commits de `HEAD` — dette #37) :
--
--   git grep -n lot_libelle              HEAD -- src/   -> 0
--   git grep -n lot_libelle              1d65c53 -- src/ -> 0
--   git grep -n destinataires_agence_lot HEAD -- src/   -> 0
--   git grep -n destinataires_agence_lot 1d65c53 -- src/ -> 0
--
-- Aucune vue, aucune policy, aucun script applicatif ne les nomme non plus.
-- Les seules mentions hors base sont les entrées de `database.types.ts`, qui
-- décrivent le schéma sans l'appeler.
--
-- ⚠️ La consigne reçue citait `dashboard/lots/page.tsx:729`,
-- `ProprietaireTerrienView.tsx:320` et `useAttestations.ts:385` comme preuves
-- que ces fonctions étaient « réellement appelées par le produit ». Les DEUX
-- PREMIÈRES citations appellent bien `calculer_score_confiance` — une AUTRE
-- fonction, admise à `anon` par la ligne de base du 30/07, et hors de ce lot.
--
-- 🔴 RECTIFICATION DU 31/07/2026 : LA TROISIÈME CITATION ÉTAIT EXACTE, ET C'EST
-- CETTE MIGRATION QUI SE TROMPAIT. La première rédaction affirmait que les trois
-- lignes visaient `calculer_score_confiance`. C'est faux pour la troisième. Le
-- fichier est `src/features/mobile/data/useAttestations.ts` et il appelle bien,
-- à ses lignes 385-386 :
--
--     supabase.rpc("lot_peut_emettre_attestation_niveau1", { p_lot_id: lotId }),
--     supabase.rpc("manques_documentaires_lot", { p_lot_id: lotId, p_niveau: 1 }),
--
-- L'erreur vient de la méthode de recherche, pas de la consigne : ce fichier
-- N'EXISTE PAS dans le front déployé `1d65c53` (`git cat-file -e
-- 1d65c53:src/features/mobile/data/useAttestations.ts` -> absent), donc le grep
-- sur le déployé rendait vide. Mais il est EMBARQUÉ DANS L'APK : la chaîne
-- `lot_peut_emettre_attestation_niveau1` est présente dans DEUX bundles de
-- `android/app/src/main/assets/public/_next/static/chunks/`, tout comme
-- `manques_documentaires_lot`.
--
-- ✅ CONSÉQUENCE : la décision de LAISSER OUVERTES `score_confiance_lot` et
-- `lot_peut_emettre_attestation_niveau1` (section suivante) est MIEUX FONDÉE que
-- son motif écrit ne le montrait. Les fermer n'aurait pas seulement cassé les
-- deux vues de `/dashboard/documents` : cela aurait cassé L'APPLICATION MOBILE,
-- dont l'écran de génération d'attestation appelle la seconde à chaque ouverture
-- de fiche.
--
-- ✅ CONTRE-ÉPREUVE, et elle vaut pour ce lot-ci : `lot_libelle` et
-- `destinataires_agence_lot` sont RECHERCHÉES DANS L'APK AUSSI, et n'y figurent
-- pas (`grep -rl lot_libelle android/app/src/main/assets/` -> 0). Les deux
-- révocations ci-dessous ne cassent donc rien, ni sur le web ni sur mobile.
--
-- ---------------------------------------------------------------------------
-- LES DEUX AUTRES CIBLES NE SONT PAS TRAITÉES — ET C'EST DÉLIBÉRÉ
-- ---------------------------------------------------------------------------
--
-- `score_confiance_lot(uuid)` et `lot_peut_emettre_attestation_niveau1(uuid)`
-- restent ouvertes à `authenticated`. Les fermer aurait été un FAUX VERT :
--
-- ① Elles ne dénieraient rien au cédant. `score_confiance_lot(x)` est
--    littéralement `calculer_score_confiance(x)->>'total'`, et
--    `lot_peut_emettre_attestation_niveau1` n'ajoute au même calcul que le
--    booléen `derogation_documents_le is not null`. Or
--    `calculer_score_confiance(uuid)` est ouverte à **`anon`** par la ligne de
--    base admise du 30/07 : la même information reste accessible SANS COMPTE.
--    Fermer la façade en laissant la porte est une décoration.
--
-- ② Les fermer casserait un écran DÉPLOYÉ, en silence. Les vues
--    `v_attestations_bloquees_documents` et `v_attestations_gratuites_manquantes`
--    sont en `security_invoker = true` : le privilège d'exécution y est vérifié
--    contre le LECTEUR, pas contre `postgres`. `/dashboard/documents` les lit
--    (déployé : `src/app/dashboard/documents/page.tsx:1050,1055,1057`) via
--    `count ?? 0` et `data ?? []`, SANS jamais lire `error` — un `42501` s'y
--    afficherait comme « 0 attestation bloquée », c'est-à-dire comme une bonne
--    nouvelle.
--
-- Refermer ces deux-là suppose donc de statuer d'abord sur l'exposition de
-- `calculer_score_confiance` à `anon` (deux gestes : ACL + ligne de base de
-- `controle_exposition_anon()`), et de donner un chemin de lecture aux deux
-- vues. C'est un arbitrage du propriétaire, pas une correction technique.
--
-- ---------------------------------------------------------------------------
-- CE QUE LE CÉDANT CONSERVE (arbitrage 3 du propriétaire)
-- ---------------------------------------------------------------------------
--
-- Rien ici ne touche `attributions` ni `attestations_*`. AKE garde sa propre
-- ligne d'attribution passée sur le lot cédé (rang 1, `actuel = false`) : sa
-- trace. Mesuré avant ET après, elle vaut 1 sous son identité.
-- (Sur ce lot précis, `attestations_attribution_lot` est vide : il n'existe
-- aucun acte signé par lui à préserver.)
--
-- Le registre public nominatif reste ouvert par le QR : `verification-qr`
-- appelle en `service_role`, qui conserve `EXECUTE` ci-dessous.
-- ============================================================================

-- Mesuré avant exécution : `proacl` vaut, pour les deux fonctions,
-- {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}.
-- `PUBLIC` et `anon` n'y figuraient donc pas — ils sont nommés malgré tout,
-- conformément à la règle permanente ① de docs/06-CODING_STANDARDS.md §5 bis,
-- pour que la fermeture soit explicite et non déduite d'un état constaté.
revoke execute on function public.lot_libelle(uuid)
  from public, anon, authenticated;

revoke execute on function public.destinataires_agence_lot(uuid)
  from public, anon, authenticated;

-- `postgres` (propriétaire, donc les cinq fonctions de déclencheur) et
-- `service_role` (edge functions, dont `verification-qr`) conservent EXECUTE.
grant execute on function public.lot_libelle(uuid) to service_role;
grant execute on function public.destinataires_agence_lot(uuid) to service_role;

comment on function public.lot_libelle(uuid) is
  'Libellé et lieu d''un lot. FERMÉE à authenticated le 31/07/2026 : elle rendait '
  'le libellé du bien à TOUT compte connecté, y compris au cédant et à un compte '
  'sans aucun rattachement. Appelée uniquement depuis la base par les fonctions '
  'notif_* (SECURITY DEFINER, propriétaire postgres) et par service_role. '
  'Aucun appelant dans src/ (HEAD ni déployé 1d65c53).';

comment on function public.destinataires_agence_lot(uuid) is
  'Identifiants des profils à notifier pour un lot. FERMÉE à authenticated le '
  '31/07/2026 : elle rendait 6 identifiants de profils à TOUT compte connecté. '
  'Appelée uniquement depuis la base par notif_certificat_vente et '
  'notif_demande_acquisition (SECURITY DEFINER, propriétaire postgres).';
