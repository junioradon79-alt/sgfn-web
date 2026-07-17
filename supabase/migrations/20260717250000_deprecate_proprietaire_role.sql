-- Dépréciation du rôle legacy `proprietaire` (« propriétaire par achat »).
--
-- Rôle mort : aucun flux ne l'assigne (l'acquéreur qui solde un achat reste
-- `acquereur` ; `handle_new_user` retombe sur `acquereur`). 1 seul compte test,
-- et son espace /dashboard/proprietaire est un doublon de l'espace
-- proprietaire_terrien (« Mes lots » scopé au profil). On le fond dedans.

-- 1) Tout compte proprietaire devient proprietaire_terrien (il conserve la vue
--    « Mes lots » via son attributaire_id). Idempotent.
update profiles set groupe = 'proprietaire_terrien' where groupe = 'proprietaire';

-- 2) Nettoyage des clauses RLS mortes : retrait de la seule valeur 'proprietaire'
--    (proprietaire_terrien et les autres rôles restent STRICTEMENT inchangés).

-- APFC : retirer proprietaire de la lecture nationale.
alter policy apfc_read on attestations_coutumieres
using (
  est_admin()
  or ((mon_groupe() = 'chefferie') and (autorite_coutumiere_id = ma_chefferie_id()))
  or (mon_groupe() = any (array['operateur','verificateur','geometre']::groupe_utilisateur[]))
  or ((mon_groupe() = 'proprietaire_terrien') and (famille_id = ma_famille_id()))
);

-- Attributions : retirer proprietaire du groupe scopé par mes_lot_ids().
alter policy attributions_read on attributions
using (
  est_admin()
  or (attributaire_id = mon_attributaire_id())
  or (mon_groupe() = any (array['chefferie','operateur_saisie','verificateur']::groupe_utilisateur[]))
  or ((mon_groupe() = 'operateur') and (lot_id in (select lot_ids_operateur())))
  or ((mon_groupe() = 'commissaire') and (lot_id in (select lot_ids_commissaire())))
  or ((mon_groupe() = any (array['proprietaire_terrien','acquereur']::groupe_utilisateur[])) and (lot_id in (select mes_lot_ids())))
);

-- Lots : retirer la clause proprietaire (scopée famille_id) de lots_read_scope.
alter policy lots_read_scope on lots
using (
  est_admin()
  or (exists (
    select 1 from ilots i join lotissements lo on lo.id = i.lotissement_id
    where i.id = lots.ilot_id and (
      ((mon_groupe() = 'chefferie') and (lo.autorite_coutumiere_id = ma_chefferie_id()))
      or ((mon_groupe() = 'operateur') and (lo.operateur_id = mon_operateur_id()))
      or (mon_groupe() = 'verificateur')
      or ((mon_groupe() = 'commissaire') and (lo.pv_commissaire_justice_id = mon_commissaire_id()))
      or ((mon_groupe() = any (array['chefferie','proprietaire_terrien']::groupe_utilisateur[])) and (lo.famille_id is not null) and (lo.famille_id = (select profiles.famille_id from profiles where profiles.id = (select auth.uid()))))
    )
  ))
  or (exists (
    select 1 from attributions a where a.lot_id = lots.id and a.attributaire_id = mon_attributaire_id() and a.actuel
  ))
);

-- L'enum `proprietaire` est laissée en place (inutilisée), comme pour `amenageur`.
