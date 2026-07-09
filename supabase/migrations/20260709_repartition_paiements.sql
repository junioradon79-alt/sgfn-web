-- Répartition automatique des paiements + frais agrégateur (09/07/2026)
--
-- Dès qu'un paiement est confirmé, on ventile automatiquement le montant entre les
-- bénéficiaires, dans une table `repartitions_paiement` :
--   • Vente (prix du lot)  → Propriétaire = 100 % ; SGNF 0. Frais agrégateur
--     ABSORBÉS par l'acquéreur (ligne en plus, ne réduit pas la part Propriétaire).
--   • Attestation de cession → Chefferie (montant reversé) + Commission SGNF, et les
--     frais agrégateur sont DÉDUITS de la commission SGNF (SGNF net = commission − frais).
--   • Autres (honoraires…) → bénéficiaire + commission SGNF (− frais).
--
-- Frais agrégateur = montant FIXE par transaction (configurable, défaut 0), appliqué
-- uniquement aux paiements EN LIGNE (mobile money). Guichet (espèces/virement) = 0.

-- 1. Paramètre configurable
insert into public.parametres_paiement (cle, valeur, description)
values ('frais_agregateur_fixe', '0',
        'Frais fixes de l''agrégateur de paiement (CinetPay) par transaction en ligne, en FCFA. Déduits de la commission SGNF (attestation) ou absorbés par l''acquéreur (vente).')
on conflict (cle) do nothing;

-- 2. Colonne frais sur le paiement
alter table public.paiements add column if not exists frais_agregateur numeric not null default 0;

-- 3. Table de ventilation
create table if not exists public.repartitions_paiement (
  id                uuid primary key default gen_random_uuid(),
  paiement_id       uuid not null references public.paiements(id) on delete cascade,
  beneficiaire_type text not null,   -- proprietaire | chefferie | sgfn | agregateur
  nom               text,
  montant           numeric not null default 0,
  cree_le           timestamptz not null default now()
);
create index if not exists idx_repart_paiement on public.repartitions_paiement(paiement_id);

alter table public.repartitions_paiement enable row level security;
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
  );

-- 4. BEFORE : fixer les frais agrégateur à la confirmation (paiement en ligne)
create or replace function public.set_frais_agregateur()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare v_fixe numeric := 0;
begin
  if new.statut = 'confirme' and new.moyen in ('wave','orange_money','mtn_money','moov_money') then
    select coalesce((valeur)::numeric, 0) into v_fixe
    from parametres_paiement where cle = 'frais_agregateur_fixe';
    new.frais_agregateur := coalesce(v_fixe, 0);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_frais_agregateur on public.paiements;
create trigger trg_set_frais_agregateur
  before insert or update on public.paiements
  for each row execute function public.set_frais_agregateur();

-- 5. AFTER : ventiler le paiement à la confirmation
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
    select ac.nom into v_chef
    from cessions c
    join lots l on l.id = c.lot_id
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    join autorites_coutumieres ac on ac.id = lo.autorite_coutumiere_id
    where c.id = new.cession_id;

    v_frais_att := least(v_frais, v_comm);  -- les frais ne dépassent pas la commission

    insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
    values (new.id, 'chefferie', coalesce(v_chef, 'Chefferie'), v_reverse);
    insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
    values (new.id, 'sgfn', 'Commission SGNF', v_comm - v_frais_att);
    if v_frais_att > 0 then
      insert into repartitions_paiement (paiement_id, beneficiaire_type, nom, montant)
      values (new.id, 'agregateur', 'Agrégateur (déduit de la commission SGNF)', v_frais_att);
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

drop trigger if exists trg_ventiler_paiement on public.paiements;
create trigger trg_ventiler_paiement
  after insert or update on public.paiements
  for each row execute function public.ventiler_paiement();
