-- ═══════════════════════════════════════════════════════════════════════════
-- S3 — policy `lots_read_scope` : retrait de la branche « meme famille »
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MOTIF
--
-- Branche retiree :
--
--     (mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien']))
--     AND (lo.famille_id IS NOT NULL)
--     AND (lo.famille_id = (SELECT profiles.famille_id
--                           FROM profiles WHERE profiles.id = auth.uid()))
--
-- ⭐ CETTE BRANCHE NE PASSE PAS PAR `attributions`. Aucune attribution n'y est
-- requise, ni actuelle ni passee : l'appartenance a la famille du LOTISSEMENT
-- suffisait. C'est pour cela qu'un compte sans AUCUNE attribution lisait 49
-- lots, et qu'un cedant integral continuait de lire l'ensemble du lotissement
-- dont il etait sorti. L'ancrage retenu par le proprietaire du projet est la
-- bascule `attributions.actuel = false` — la branche famille la contournait
-- entierement.
--
-- Mesure du 31/07/2026, emprunt de role, une transaction par identite :
--
--   e7091e37-…  chefferie, juridiction a9c32cda, famille (null)   898 lots
--   0be830c7-…  chefferie SANS juridiction, famille 2f980fc3       49 lots
--   6155d411-…  AKE AMAFIN NICODEME, PT, 12 lots actuels           49 lots
--   e7e93d42-…  PT, famille 2f980fc3, AUCUN attributaire           49 lots
--   9a1c4e7b-…  N'CHO OHOUO BONIFACE, PT, 110 lots actuels        155 lots
--
-- Les 49 sont exactement les lots du lotissement Koelea-Accor
-- (`lotissements.famille_id = 2f980fc3-…`), quelle que soit l'attribution.
--
-- ⭐ TEMOINS POSITIFS conserves — la policy ne doit pas devenir un refus
-- generalise. Les autres branches sont gardees TELLES QUELLES :
--   * `est_admin()` ;
--   * chefferie par juridiction (`lo.autorite_coutumiere_id = ma_chefferie_id()`) ;
--   * operateur par `lo.operateur_id` ;
--   * verificateur ;
--   * commissaire par `lo.pv_commissaire_justice_id` ;
--   * et surtout la derniere : `attributions a` avec `a.actuel` — c'est elle
--     qui laisse un proprietaire EN TITRE voir ses lots, et elle porte deja
--     l'ancrage `actuel`.
--
-- HORS PERIMETRE, laisse intact par decision explicite du proprietaire du
-- projet : `lots_read_metier` (898 lots ouverts a `operateur_saisie`,
-- `geometre`, `agent_ia`, `verificateur`) et `lots_marketplace_public_read`.
-- `alter policy` est prefere a `drop`+`create` : la table n'est a aucun
-- instant sans policy de lecture.

alter policy lots_read_scope on public.lots
using (
  est_admin()
  or (exists (
        select 1
        from ilots i
        join lotissements lo on lo.id = i.lotissement_id
        where i.id = lots.ilot_id
          and (
               (mon_groupe() = 'chefferie'::groupe_utilisateur
                and lo.autorite_coutumiere_id = ma_chefferie_id())
            or (mon_groupe() = 'operateur'::groupe_utilisateur
                and lo.operateur_id = mon_operateur_id())
            or (mon_groupe() = 'verificateur'::groupe_utilisateur)
            or (mon_groupe() = 'commissaire'::groupe_utilisateur
                and lo.pv_commissaire_justice_id = mon_commissaire_id())
          )
     ))
  or (exists (
        select 1
        from attributions a
        where a.lot_id = lots.id
          and a.attributaire_id = mon_attributaire_id()
          and a.actuel
     ))
);
