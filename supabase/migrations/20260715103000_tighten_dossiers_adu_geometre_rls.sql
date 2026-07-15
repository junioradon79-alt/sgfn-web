-- dossiers_read accordait la lecture de TOUTE la table dossiers_adu à quiconque avait
-- mon_groupe()='geometre', pas seulement ses dossiers assignés (contrairement à
-- missions_geometre/pv_bornage qui scopent déjà via mon_geometre_id()). Resserré avant
-- d'ouvrir l'inscription à de vrais géomètres externes.
drop policy if exists dossiers_read on public.dossiers_adu;

create policy dossiers_read on public.dossiers_adu
for select
using (
  est_admin()
  or demandeur_id = mon_attributaire_id()
  or mon_groupe() = any (array['verificateur','commissaire','chefferie','proprietaire_terrien']::groupe_utilisateur[])
  or (mon_groupe() = 'geometre' and geometre_id = mon_geometre_id())
);
