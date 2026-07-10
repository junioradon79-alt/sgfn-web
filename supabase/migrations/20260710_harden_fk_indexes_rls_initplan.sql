-- Suite de la passe de durcissement du 29/06 (add_missing_fk_indexes + optimize_rls_initplan_auth_uid).
-- Les fonctionnalités livrées entre le 07/07 et le 10/07 (proprietaire_terrien, demandes_acquisition,
-- familles/grandes_familles, tarifs, notifications) ont réintroduit le même type de drift.

-- 1) Index manquants sur 12 clés étrangères (perf jointures/filtres)
create index if not exists idx_familles_chef_profile_id on public.familles (chef_profile_id);
create index if not exists idx_familles_grande_famille_id on public.familles (grande_famille_id);
create index if not exists idx_attributaires_famille_id on public.attributaires (famille_id);
create index if not exists idx_paiements_valide_par on public.paiements (valide_par);
create index if not exists idx_conv_docs_uploaded_by on public.conversation_documents (uploaded_by);
create index if not exists idx_tarifs_maj_par on public.tarifs (maj_par);
create index if not exists idx_tarifs_attestation_chefferie_maj_par on public.tarifs_attestation_chefferie (maj_par);
create index if not exists idx_demandes_acq_attributaire on public.demandes_acquisition (attributaire_id);
create index if not exists idx_demandes_acq_cession on public.demandes_acquisition (cession_id);
create index if not exists idx_demandes_acq_conversation on public.demandes_acquisition (conversation_id);
create index if not exists idx_demandes_acq_traite_par on public.demandes_acquisition (traite_par);
create index if not exists idx_demandes_acq_vente on public.demandes_acquisition (vente_id);

-- 2) auth.uid() -> (select auth.uid()) sur les 6 policies non optimisées (InitPlan, évalué 1x/requête)
-- Logique inchangée, seuls les appels directs à auth.uid() sont enveloppés.

alter policy "lots_read_scope" on public.lots
using (
  est_admin() or (exists (
    select 1
    from ilots i
    join lotissements lo on (lo.id = i.lotissement_id)
    where i.id = lots.ilot_id
      and (
        (mon_groupe() = 'chefferie'::groupe_utilisateur and lo.autorite_coutumiere_id = ma_chefferie_id())
        or (mon_groupe() = 'operateur'::groupe_utilisateur and lo.operateur_id = mon_operateur_id())
        or (mon_groupe() = 'proprietaire'::groupe_utilisateur and lo.famille_id = (
          select profiles.famille_id from profiles where profiles.id = (select auth.uid())
        ))
        or mon_groupe() = 'verificateur'::groupe_utilisateur
        or mon_groupe() = 'commissaire'::groupe_utilisateur
        or (
          mon_groupe() = any (array['chefferie'::groupe_utilisateur, 'proprietaire_terrien'::groupe_utilisateur])
          and lo.famille_id is not null
          and lo.famille_id = (
            select profiles.famille_id from profiles where profiles.id = (select auth.uid())
          )
        )
      )
  )) or (exists (
    select 1 from attributions a
    where a.lot_id = lots.id and a.attributaire_id = mon_attributaire_id() and a.actuel
  ))
);

alter policy "gf_all_admin" on public.grandes_familles
using (
  exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.groupe = 'admin'::groupe_utilisateur)
)
with check (
  exists (select 1 from profiles where profiles.id = (select auth.uid()) and profiles.groupe = 'admin'::groupe_utilisateur)
);

alter policy "scans_qr_select_admin" on public.scans_qr
using (
  exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.groupe = any (array['admin'::groupe_utilisateur, 'operateur'::groupe_utilisateur])
  )
);

alter policy "da_agence_read" on public.demandes_acquisition
using (
  est_admin() or (exists (
    select 1
    from lots l
    join ilots i on (i.id = l.ilot_id)
    join lotissements lo on (lo.id = i.lotissement_id)
    join profiles p on (p.id = (select auth.uid()))
    where l.id = demandes_acquisition.lot_id
      and (
        (p.groupe = 'operateur'::groupe_utilisateur and p.operateur_id is not null and p.operateur_id = lo.operateur_id)
        or (p.groupe = 'chefferie'::groupe_utilisateur and p.famille_id is not null and p.famille_id = lo.famille_id)
      )
  ))
);

alter policy "da_demandeur_read" on public.demandes_acquisition
using (demandeur_profile_id = (select auth.uid()));

alter policy "notif_read" on public.notifications
using (destinataire_profile_id = (select auth.uid()) or est_admin());
