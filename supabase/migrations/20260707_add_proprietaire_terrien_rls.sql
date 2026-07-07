-- RLS pour le nouveau rôle "proprietaire_terrien" : additif uniquement, 'chefferie' et
-- 'proprietaire_terrien' cohabitent partout où l'accès "chef de famille" était accordé.
-- Corrige au passage un bug réel dans lots_read_scope : la branche famille_id vérifiait
-- mon_groupe()='proprietaire' au lieu de 'chefferie'/'proprietaire_terrien', ce qui
-- empêchait tout compte "chef de famille" (ex. N'CHO KOUTOUAN JULES) de voir ses lots
-- personnels — branche ajoutée en plus de l'existante, aucune branche retirée.

ALTER POLICY apfc_read ON public.attestations_coutumieres
USING (
  est_admin() OR mon_groupe() = ANY (ARRAY[
    'chefferie','proprietaire','operateur','verificateur','geometre','commissaire','proprietaire_terrien'
  ]::groupe_utilisateur[])
);

ALTER POLICY attributions_read ON public.attributions
USING (
  est_admin() OR attributaire_id = mon_attributaire_id() OR mon_groupe() = ANY (ARRAY[
    'chefferie','operateur','proprietaire','verificateur','commissaire','proprietaire_terrien'
  ]::groupe_utilisateur[])
);

ALTER POLICY dossiers_read ON public.dossiers_adu
USING (
  est_admin() OR demandeur_id = mon_attributaire_id() OR mon_groupe() = ANY (ARRAY[
    'verificateur','commissaire','geometre','chefferie','proprietaire_terrien'
  ]::groupe_utilisateur[])
);

ALTER POLICY pv_famille_chefferie_read ON public.pv_reunions_famille
USING (est_admin() OR mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien']::groupe_utilisateur[]));

ALTER POLICY pv_famille_lots_chefferie_read ON public.pv_reunions_famille_lots
USING (est_admin() OR mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien']::groupe_utilisateur[]));

ALTER POLICY pv_famille_membres_chefferie_read ON public.pv_reunions_famille_membres
USING (est_admin() OR mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien']::groupe_utilisateur[]));

ALTER POLICY lots_read_scope ON public.lots
USING (
  est_admin()
  OR EXISTS (
    SELECT 1 FROM ilots i JOIN lotissements lo ON lo.id = i.lotissement_id
    WHERE i.id = lots.ilot_id AND (
      (mon_groupe() = 'chefferie' AND lo.autorite_coutumiere_id = ma_chefferie_id())
      OR (mon_groupe() = 'operateur' AND lo.operateur_id = mon_operateur_id())
      OR (mon_groupe() = 'proprietaire' AND lo.famille_id = (SELECT profiles.famille_id FROM profiles WHERE profiles.id = auth.uid()))
      OR mon_groupe() = 'verificateur' OR mon_groupe() = 'commissaire'
      OR (
        mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien']::groupe_utilisateur[])
        AND lo.famille_id IS NOT NULL
        AND lo.famille_id = (SELECT profiles.famille_id FROM profiles WHERE profiles.id = auth.uid())
      )
    )
  )
  OR EXISTS (SELECT 1 FROM attributions a WHERE a.lot_id = lots.id AND a.attributaire_id = mon_attributaire_id() AND a.actuel)
);
