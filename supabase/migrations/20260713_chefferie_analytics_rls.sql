-- TerraCI Analytics — dashboard institutionnel chefferie (13/07/2026)
--
-- La chefferie n'avait aucun accès en lecture à attestations_cession, litiges
-- et repartitions_paiement — alors que ChefVillageView interroge déjà les deux
-- premières pour ses panneaux de signature. Sans ces policies, ces panneaux
-- sont silencieusement vides pour une vraie session chefferie, et aucun KPI
-- territorial (actes, litiges, recettes) n'est possible.

-- 1. attestations_cession — même pattern de jointure que lots_read_scope.
create policy attcess_chefferie_read on public.attestations_cession
for select to authenticated
using (
  mon_groupe() = 'chefferie'::groupe_utilisateur
  and exists (
    select 1 from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = attestations_cession.lot_id
      and lo.autorite_coutumiere_id = ma_chefferie_id()
  )
);

-- 2. litiges — idem via litiges.lot_id.
create policy litiges_chefferie_read on public.litiges
for select to authenticated
using (
  mon_groupe() = 'chefferie'::groupe_utilisateur
  and exists (
    select 1 from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = litiges.lot_id
      and lo.autorite_coutumiere_id = ma_chefferie_id()
  )
);

-- 3. repartitions_paiement — la jointure passerait par paiements/cessions,
-- deux tables non lisibles par la chefferie (RLS admin/acquéreur uniquement) ;
-- une policy qui les référence dans son USING échouerait silencieusement (la
-- RLS des tables jointes s'applique aussi dans la sous-requête). On dénormalise
-- plutôt l'autorité coutumière sur la ligne elle-même, comme ventiler_paiement()
-- le fait déjà pour le nom de la chefferie (v_chef).
alter table public.repartitions_paiement
  add column if not exists autorite_coutumiere_id uuid references public.autorites_coutumieres(id);
create index if not exists idx_repart_autorite on public.repartitions_paiement(autorite_coutumiere_id);

create or replace function public.ventiler_paiement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_frais    numeric := coalesce(new.frais_agregateur, 0);
  v_comm     numeric := coalesce(new.commission_sgfn, 0);
  v_reverse  numeric := coalesce(new.montant_total, 0) - coalesce(new.commission_sgfn, 0);
  v_chef     text;
  v_autorite_id uuid;
  v_frais_att numeric;
begin
  if new.statut <> 'confirme' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'confirme' then return new; end if; -- déjà ventilé

  delete from repartitions_paiement where paiement_id = new.id;

  if new.type = 'vente_terrain' then
    -- Propriétaire = 100 % du prix ; frais absorbés par l'acquéreur (ligne en plus)
    insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
    values (new.id, 'proprietaire', coalesce(new.beneficiaire, 'Propriétaire'), coalesce(new.montant_total, 0));
    if v_frais > 0 then
      insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
      values (new.id, 'agregateur', 'Agrégateur (absorbé par l''acquéreur)', v_frais);
    end if;

  elsif new.type = 'attestation_cession' then
    select ac.nom, lo.autorite_coutumiere_id into v_chef, v_autorite_id
    from cessions c
    join lots l on l.id = c.lot_id
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    join autorites_coutumieres ac on ac.id = lo.autorite_coutumiere_id
    where c.id = new.cession_id;

    v_frais_att := least(v_frais, v_comm);  -- les frais ne dépassent pas la commission

    -- Autorité coutumière posée sur les 3 lignes : transparence totale du
    -- territoire pour la chefferie, même logique que ce que voit déjà
    -- l'acquéreur sur son propre paiement (repart_read).
    insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant, autorite_coutumiere_id)
    values (new.id, 'chefferie', coalesce(v_chef, 'Chefferie'), v_reverse, v_autorite_id);
    insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant, autorite_coutumiere_id)
    values (new.id, 'sgfn', 'Commission SGNF', v_comm - v_frais_att, v_autorite_id);
    if v_frais_att > 0 then
      insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant, autorite_coutumiere_id)
      values (new.id, 'agregateur', 'Agrégateur (déduit de la commission SGNF)', v_frais_att, v_autorite_id);
    end if;

  else
    -- honoraires / autre : bénéficiaire + commission SGNF (− frais)
    v_frais_att := least(v_frais, v_comm);
    if v_reverse > 0 then
      insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
      values (new.id, 'proprietaire', coalesce(new.beneficiaire, 'Bénéficiaire'), v_reverse);
    end if;
    if v_comm > 0 then
      insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
      values (new.id, 'sgfn', 'Commission SGNF', v_comm - v_frais_att);
      if v_frais_att > 0 then
        insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
        values (new.id, 'agregateur', 'Agrégateur', v_frais_att);
      end if;
    end if;
  end if;

  return new;
end;
$function$;

drop policy if exists repart_read on public.repartitions_paiement;
create policy repart_read on public.repartitions_paiement
  for select to authenticated
  using (
    public.est_admin()
    or exists (
      select 1 from public.paiements p
      where p.id = repartitions_paiement.paiement_id
        and p.acquereur_id is not null
        and p.acquereur_id = public.mon_attributaire_id()
    )
    or (
      public.mon_groupe() = 'chefferie'::groupe_utilisateur
      and repartitions_paiement.autorite_coutumiere_id = public.ma_chefferie_id()
    )
  );
