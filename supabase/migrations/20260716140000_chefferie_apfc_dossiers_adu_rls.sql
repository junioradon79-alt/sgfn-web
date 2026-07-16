-- Corrige deux lectures nationales non scopées pour la chefferie (chef de
-- village), sur le même modèle que litiges_chefferie_read/attcess_chefferie_read
-- (join lots→ilots→lotissements, comparaison à ma_chefferie_id()) :
--   - attestations_coutumieres (APFC) : la chefferie voyait toutes les APFC du
--     pays, pas seulement celles de son autorité coutumière.
--   - dossiers_adu : la chefferie voyait tous les dossiers ADU du pays (même
--     trou déjà corrigé pour le géomètre le 15/07, jamais fait pour la
--     chefferie). Les autres rôles de ces policies (proprietaire/operateur/
--     verificateur/geometre/commissaire/proprietaire_terrien) restent en
--     lecture nationale, inchangés.

drop policy if exists apfc_read on public.attestations_coutumieres;
create policy apfc_read on public.attestations_coutumieres
for select to authenticated
using (
  est_admin()
  or (mon_groupe() = 'chefferie'::groupe_utilisateur and autorite_coutumiere_id = ma_chefferie_id())
  or mon_groupe() = any (array[
    'proprietaire','operateur','verificateur','geometre','commissaire','proprietaire_terrien'
  ]::groupe_utilisateur[])
);

drop policy if exists dossiers_read on public.dossiers_adu;
create policy dossiers_read on public.dossiers_adu
for select
using (
  est_admin()
  or demandeur_id = mon_attributaire_id()
  or mon_groupe() = any (array['verificateur','commissaire','proprietaire_terrien']::groupe_utilisateur[])
  or (mon_groupe() = 'geometre' and geometre_id = mon_geometre_id())
  or (mon_groupe() = 'chefferie' and exists (
        select 1 from lots l
        join ilots i on i.id = l.ilot_id
        join lotissements lo on lo.id = i.lotissement_id
        where l.id = dossiers_adu.lot_id and lo.autorite_coutumiere_id = ma_chefferie_id()
      ))
);
