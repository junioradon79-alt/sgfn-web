-- ============================================================================
--  Généralisation du score de confiance et du gating par type_lotissement
--  (Phase B, 20/08/2026) -- DÉPEND de la migration précédente
--  (20260820100000_arretes_approbation_et_acd_lotissement_schema.sql, qui crée
--  arretes_approbation_lotissement/arretes_acd_lotissement) : ce fichier lit
--  ces deux tables, il ne peut pas s'appliquer seul.
--
--  ── LE CRITÈRE À 40/20/10/0 PTS N'ÉTAIT LISIBLE QUE SUR L'APFC ────────────
--  `calculer_score_confiance()` (20260716091500) lisait exclusivement
--  `attestations_coutumieres.statut` pour le critère à 40 points, quel que
--  soit le type du lotissement. Depuis la Phase A (20260818120000),
--  `lotissements.type_lotissement` distingue villageois/approuve/acd, mais le
--  score n'en tenait encore aucun compte : un lotissement 'approuve' comme
--  Brignan Kakodji était encore jugé sur une APFC qu'il n'aura jamais.
--
--  ── CE QUI CHANGE, ET CE QUI NE CHANGE PAS ────────────────────────────────
--  Seul `calculer_score_confiance()` est redéfini ici : il résout désormais
--  le type_lotissement du lot (jointure lots->ilots->lotissements, déjà
--  utilisée ailleurs dans ce projet) puis lit la table correspondante
--  (villageois -> attestations_coutumieres, approuve ->
--  arretes_approbation_lotissement, acd -> arretes_acd_lotissement), avec le
--  MÊME barème (40/20/10/0) et sous la MÊME clé JSON `apfc`.
--
--  Le nom de clé `apfc` est CONSERVÉ à dessein, pas renommé en quelque chose
--  de plus générique : elle est lue par `lot_peut_emettre_attestation_
--  niveau1/niveau2`, `manques_documentaires_lot`, `message_refus_
--  documentaire`, les vues `v_attestations_gratuites_manquantes`/
--  `v_attestations_bloquees_documents`, et 6 fichiers TypeScript (dashboards
--  lots/commissaire/proprietaire-terrien, AvertissementDocumentaire web +
--  mobile). Renommer la clé aurait fallu toucher tout ce blast radius pour un
--  gain cosmétique nul : le TOTAL et le comportement de gating sont ce qui
--  compte, et ils sont déjà corrects avec la clé inchangée. Conséquence
--  directe et vérifiée : `lot_peut_emettre_attestation_niveau1/niveau2` n'ont
--  BESOIN D'AUCUNE modification -- ils lisent `(j->>'apfc')::int`, qui est
--  déjà la valeur généralisée. Seul le nom d'affichage "APFC" dans
--  `LotDetailModal.tsx` (SCORE_LABELS) resterait figé sur "APFC" même pour un
--  lotissement approuve/acd -- hors périmètre de cette Phase B (composants
--  listés : ApfcForm/ArreteApprobationForm/ArreteAcdForm/LotissementTable
--  seulement), signalé au rapport final, pas corrigé ici en silence.
--
--  `manques_documentaires_lot(uuid, int)` EST redéfini : le message doit
--  nommer la bonne pièce selon le type (APFC / Arrêté d'approbation / Arrêté
--  ACD), pas un texte fixe qui suppose toujours l'APFC.
--  `message_refus_documentaire(uuid, int)` n'est PAS touché : il ne fait que
--  formater le tableau retourné par `manques_documentaires_lot`, il hérite du
--  changement sans modification.
--
--  ── BALAYAGE DES AUTRES LECTEURS (fait avant d'écrire, 20/08) ─────────────
--  `grep -r calculer_score_confiance` / `grep -r attestations_coutumieres` sur
--  `supabase/migrations/` et `src/` : tous les appelants identifiés passent
--  par `calculer_score_confiance()`/`score_confiance_lot()` (déjà généralisés
--  transitivement) ou lisent `attestations_coutumieres` pour un AUTRE usage
--  que le score (signature chefferie, verifier_document, résolution d'
--  `apfc_id` sur les attestations générées -- ce dernier point : les 4 RPC de
--  génération font `select apfc.id into v_apfc_id from ... join
--  attestations_coutumieres apfc on apfc.lotissement_id = lo.id ... limit 1`
--  ; pour un lotissement approuve/acd sans APFC, cette jointure ne trouve
--  simplement aucune ligne et `v_apfc_id` reste NULL -- `apfc_id` est une FK
--  NULLABLE sur attestations_cession/attestations_attribution_lot, donc AUCUNE
--  erreur, juste un champ de provenance non renseigné. Comportement déjà en
--  place avant cette migration, hors du périmètre "score de confiance" de la
--  demande d'origine, signalé ici pour mémoire plutôt que traité en silence).
--
--  ⚠️ TROUVÉ EN COURS DE BALAYAGE, NON TOUCHÉ : `manques_documentaires_lot`
--  et `message_refus_documentaire` portent CHACUN deux surcharges en base --
--  une à 1 argument (`p_lot_id uuid`, héritée de 20260722200000, antérieure
--  au split niveau1/niveau2) et une à 2 arguments (`p_lot_id uuid, p_niveau
--  int default 1`, 20260723210000, la seule appelée par tout le code actuel
--  -- vérifié par grep, aucun appelant SQL ni TypeScript n'utilise plus la
--  forme à 1 argument). Cette migration ne redéfinit QUE la forme à 2
--  arguments (celle réellement utilisée) : la surcharge à 1 argument reste
--  un code mort avec l'ancien texte non généralisé ("APFC absente" en dur).
--  Signalé au rapport plutôt que supprimé en silence -- une suppression de
--  fonction est un changement de surface d'API que cette tâche ne demandait
--  pas.
-- ============================================================================

create or replace function public.calculer_score_confiance(p_lot_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with lot as (
    select l.*, i.lotissement_id
    from lots l
    join ilots i on i.id = l.ilot_id
    where l.id = p_lot_id
  ),
  lo as (
    select * from lotissements where id = (select lotissement_id from lot)
  ),
  -- Résout la pièce foncière principale selon le type du lotissement --
  -- villageois lit attestations_coutumieres (comportement inchangé, y
  -- compris le départage par statut le plus favorable en cas de lignes
  -- multiples), approuve/acd lisent la table dédiée créée en Phase B
  -- (lotissement_id y est UNIQUE : au plus une ligne, `limit 1` défensif).
  piece as (
    select case (select type_lotissement from lo)
      when 'villageois' then (
        select statut::text
        from attestations_coutumieres
        where lotissement_id = (select lotissement_id from lot)
        order by case statut
          when 'delivree' then 0
          when 'en_cours' then 1
          when 'a_delivrer' then 2
          else 3
        end
        limit 1
      )
      when 'approuve' then (
        select statut::text
        from arretes_approbation_lotissement
        where lotissement_id = (select lotissement_id from lot)
        limit 1
      )
      when 'acd' then (
        select statut::text
        from arretes_acd_lotissement
        where lotissement_id = (select lotissement_id from lot)
        limit 1
      )
    end as statut
  ),
  scores as (
    select
      (case (select statut from piece)
        when 'delivree' then 40
        when 'en_cours' then 20
        when 'a_delivrer' then 10
        else 0
      end) as score_apfc,
      (case when (select guide_reference from lo) is not null then 20 else 0 end)
        as score_guide_repartition,
      (case when (select pv_numero_enregistrement from lo) is not null then 20 else 0 end)
        as score_pv_guide_repartition,
      (case when (select pv_identification_physique_numero from lo) is not null then 20 else 0 end)
        as score_pv_identification_physique
  )
  select jsonb_build_object(
    'apfc', score_apfc,
    'guide_repartition', score_guide_repartition,
    'pv_guide_repartition', score_pv_guide_repartition,
    'pv_identification_physique', score_pv_identification_physique,
    'total', score_apfc + score_guide_repartition + score_pv_guide_repartition + score_pv_identification_physique
  )
  from scores;
$function$;

-- ACL préservée par `create or replace function` (même signature qu'avant :
-- pas de nouveau grant nécessaire) -- déjà revoke all from public + grant
-- execute to authenticated depuis 20260716091500.

-- ---------------------------------------------------------------------------
-- manques_documentaires_lot(uuid, int) -- nomme la bonne pièce selon le type
-- du lotissement, au lieu de toujours accuser "APFC".
-- ---------------------------------------------------------------------------

create or replace function public.manques_documentaires_lot(p_lot_id uuid, p_niveau int default 1)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with s as (select public.calculer_score_confiance(p_lot_id) as j),
  t as (
    select lo.type_lotissement
    from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = p_lot_id
  )
  select array_remove(array[
    case when (s.j->>'apfc')::int < 40 then
      case (select type_lotissement from t)
        when 'villageois' then
          case when (s.j->>'apfc')::int = 0 then 'APFC absente' else 'APFC non delivree' end
        when 'approuve' then
          case when (s.j->>'apfc')::int = 0 then 'Arrete d''approbation absent' else 'Arrete d''approbation non delivre' end
        when 'acd' then
          case when (s.j->>'apfc')::int = 0 then 'Arrete ACD absent' else 'Arrete ACD non delivre' end
      end
    end,
    case when (s.j->>'guide_repartition')::int = 0 then 'guide de repartition' end,
    case when (s.j->>'pv_guide_repartition')::int = 0 then 'PV du guide de repartition' end,
    case when p_niveau = 2 and (s.j->>'pv_identification_physique')::int = 0 then 'PV d''identification physique' end
  ], null)
  from s, t;
$$;

comment on function public.manques_documentaires_lot(uuid, int) is
  'Criteres documentaires manquants pour le lot, nommes. Le premier critere (40 pts) nomme la piece attendue selon lotissements.type_lotissement : APFC (villageois), Arrete d''approbation (approuve) ou Arrete ACD (acd). Niveau 2 seul exige en plus le PV d''identification physique.';

-- message_refus_documentaire(uuid, int) : AUCUNE modification -- elle ne fait
-- que formater array_to_string(manques_documentaires_lot(p_lot_id, p_niveau))
-- dans un message, elle hérite donc du nommage ci-dessus sans redéfinition.

-- lot_peut_emettre_attestation_niveau1/niveau2 : AUCUNE modification -- elles
-- lisent (calculer_score_confiance(...)->>'apfc')::int, déjà généralisé par
-- calculer_score_confiance ci-dessus sous la même clé JSON. Revérifié : leur
-- comportement pour les 3 types est correct sans y toucher (voir tests en
-- rollback du rapport de livraison).
