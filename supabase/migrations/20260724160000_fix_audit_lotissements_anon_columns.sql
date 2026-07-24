-- =====================================================================
-- CORRECTIF AUDIT 24/07 — Fuite #1 : exposition anonyme de `lotissements`
-- =====================================================================
-- Constat (audit docs/AUDIT_2026-07-24.md §1, prouvé par simulation) :
-- la policy `lotissements_public_read` = `FOR SELECT TO public USING (true)`
-- laisse un utilisateur NON connecté (anon) lire TOUTE la table, colonnes
-- sensibles comprises : latitude/longitude EXACTES, tf_numero, livre_foncier,
-- cedant, beneficiaire_immatriculation, pv_identification_physique_scan_url…
-- Cela contredit le principe de confidentialité GPS (public = flou 500 m).
--
-- Choix du correctif : privilèges au NIVEAU COLONNE plutôt que suppression de
-- la policy ou vue publique, parce que —
--   * les seuls lecteurs anon réels sont `generateStaticParams` (build, `id`)
--     et `usePublicStats` (vitrine, `id,nom`) : ils ne lisent que des colonnes
--     non sensibles → aucun changement front requis ;
--   * `/lotissements/[id]` (LotissementDetailClient) lit tf_numero/pv_* mais
--     tourne sous `AppShell` = page AUTHENTIFIÉE (rôle `authenticated`), à qui
--     on ne retire RIEN ;
--   * monterrain-web ne lit jamais `lotissements` (uniquement les vues
--     `annonces_publiques`/`photos_annonces_publiques`).
--
-- Effet : `anon` ne peut plus lire que les colonnes géographiques publiques.
-- Toute requête anon touchant une colonne sensible → « permission denied ».
-- `authenticated` conserve l'accès complet. La policy RLS `using(true)` est
-- conservée (elle ne régit que les LIGNES ; les colonnes sont régies par les
-- GRANT ci-dessous). Deny-by-default sur toute future colonne : une colonne
-- ajoutée plus tard ne sera pas lisible par anon tant qu'elle n'est pas
-- explicitement ajoutée à ce GRANT — comportement voulu.

revoke select on public.lotissements from anon;

grant select (
  id,
  nom,
  village,
  commune,
  district,
  superficie_texte,
  nb_ilots,
  nb_lots
) on public.lotissements to anon;

comment on policy lotissements_public_read on public.lotissements is
  'Lecture publique des LIGNES ; les COLONNES lisibles par anon sont restreintes par GRANT SELECT (colonnes) — cf. migration 20260724160000, correctif audit fuite GPS/cadastre. Ne pas élargir sans revue.';
