-- Écriture admin sur parametres_paiement (09/07/2026)
-- Permet de configurer depuis le front (onglet Paiements) le frais agrégateur fixe
-- et les autres paramètres. Lecture déjà ouverte à tous les authentifiés.
drop policy if exists parametres_paiement_admin_write on public.parametres_paiement;
create policy parametres_paiement_admin_write on public.parametres_paiement
  for all to authenticated
  using (public.est_admin())
  with check (public.est_admin());
