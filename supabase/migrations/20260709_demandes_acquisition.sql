-- Demandes d'acquisition (09/07/2026) — maillon manquant du tunnel acquéreur.
--
-- Parcours : l'acquéreur DÉCOUVRE (lots_verifiables) → VÉRIFIE (QR/lien payant) →
-- ENGAGE l'acquisition (cette table) → l'agence CONVERTIT en cession (creer_cession).
--
-- Aujourd'hui, entre le message d'intérêt (manifester_interet, simple fil de
-- messagerie) et creer_cession (qui exige un `attributaires` déjà existant), tout
-- se faisait à la main hors-plateforme. Cette table structure ce maillon : statut
-- pilotable côté agence, conversion en un clic qui crée l'attributaire acquéreur
-- puis appelle la RPC creer_cession existante.

-- 1. Statut de la demande
do $$ begin
  create type public.statut_demande_acquisition as enum
    ('nouvelle','en_discussion','accord','convertie','refusee','annulee');
exception when duplicate_object then null; end $$;

-- 2. Table
create table if not exists public.demandes_acquisition (
  id                    uuid primary key default gen_random_uuid(),
  lot_id                uuid not null references public.lots(id) on delete cascade,
  demandeur_profile_id  uuid not null references public.profiles(id) on delete cascade,
  acquereur_nom         text not null,
  acquereur_telephone   text,
  montant_propose       numeric,
  message               text,
  statut                public.statut_demande_acquisition not null default 'nouvelle',
  conversation_id       uuid references public.conversations(id) on delete set null,
  attributaire_id       uuid references public.attributaires(id),  -- rempli à la conversion
  cession_id            uuid references public.cessions(id),        -- rempli à la conversion
  note_agence           text,
  traite_par            uuid references public.profiles(id),
  cree_le               timestamptz not null default now(),
  maj_le                timestamptz not null default now()
);

create index if not exists idx_demandes_acq_lot on public.demandes_acquisition(lot_id);
create index if not exists idx_demandes_acq_demandeur on public.demandes_acquisition(demandeur_profile_id);
-- une seule demande "ouverte" par (lot, demandeur) — évite les doublons
create unique index if not exists uniq_demande_acq_ouverte
  on public.demandes_acquisition(lot_id, demandeur_profile_id)
  where (statut in ('nouvelle','en_discussion','accord'));

-- 3. RLS : lecture pour le demandeur (les siennes) et l'agence (admin / opérateur
--    du lotissement / chefferie de la famille). Toutes les écritures passent par
--    les RPC SECURITY DEFINER ci-dessous (pas de policy insert/update/delete).
alter table public.demandes_acquisition enable row level security;

drop policy if exists da_demandeur_read on public.demandes_acquisition;
create policy da_demandeur_read on public.demandes_acquisition
  for select to authenticated
  using (demandeur_profile_id = auth.uid());

drop policy if exists da_agence_read on public.demandes_acquisition;
create policy da_agence_read on public.demandes_acquisition
  for select to authenticated
  using (
    public.est_admin()
    or exists (
      select 1
      from public.lots l
      join public.ilots i on i.id = l.ilot_id
      join public.lotissements lo on lo.id = i.lotissement_id
      join public.profiles p on p.id = auth.uid()
      where l.id = demandes_acquisition.lot_id
        and (
          (p.groupe = 'operateur' and p.operateur_id is not null and p.operateur_id = lo.operateur_id)
          or (p.groupe = 'chefferie' and p.famille_id is not null and p.famille_id = lo.famille_id)
        )
    )
  );

-- 4. RPC — l'acquéreur engage l'acquisition d'un lot.
create or replace function public.creer_demande_acquisition(
  p_lot_id     uuid,
  p_telephone  text default null,
  p_montant    numeric default null,
  p_message    text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller  uuid := auth.uid();
  v_nom     text;
  v_tel     text;
  v_conv    uuid;
  v_id      uuid;
begin
  if v_caller is null then
    raise exception 'Authentification requise pour engager une acquisition.';
  end if;

  -- le lot doit exister et avoir un titulaire actuel (donc être cessible)
  if not exists (
    select 1 from lots l where l.id = p_lot_id
  ) then
    raise exception 'Lot introuvable.';
  end if;
  if not exists (
    select 1 from attributions a where a.lot_id = p_lot_id and a.actuel = true
  ) then
    raise exception 'Ce lot n''a pas de titulaire actuel : acquisition impossible.';
  end if;

  select nom_complet, telephone into v_nom, v_tel
  from profiles where id = v_caller;

  begin
    insert into demandes_acquisition (
      lot_id, demandeur_profile_id, acquereur_nom, acquereur_telephone, montant_propose, message
    ) values (
      p_lot_id, v_caller, coalesce(nullif(btrim(v_nom), ''), 'Acquéreur'),
      coalesce(nullif(btrim(p_telephone), ''), v_tel),
      p_montant, nullif(btrim(p_message), '')
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Vous avez déjà une demande d''acquisition en cours pour ce lot.';
  end;

  -- ouvre (ou réutilise) un fil de messagerie vers l'agence, comme manifester_interet
  begin
    select public.manifester_interet(
      p_lot_id,
      coalesce(
        nullif(btrim(p_message), ''),
        'Bonjour, je souhaite engager l''acquisition de ce lot'
          || case when p_montant is not null
                  then ' (offre : ' || to_char(p_montant, 'FM999G999G999') || ' FCFA)'
                  else '' end
          || '. Merci de me recontacter.'
      )
    ) into v_conv;
    update demandes_acquisition set conversation_id = v_conv where id = v_id;
  exception when unique_violation then
    -- une demande ouverte existe déjà pour ce lot/demandeur : on renvoie l'erreur claire
    raise;
  when others then
    -- l'échec d'ouverture du fil ne doit pas annuler la demande
    null;
  end;

  return jsonb_build_object('demande_id', v_id, 'conversation_id', v_conv);
end;
$function$;

revoke all on function public.creer_demande_acquisition(uuid, text, numeric, text) from public;
grant execute on function public.creer_demande_acquisition(uuid, text, numeric, text) to authenticated;

-- 5. RPC — l'agence fait évoluer le statut (hors conversion).
create or replace function public.maj_statut_demande_acquisition(
  p_demande_id uuid,
  p_statut     public.statut_demande_acquisition,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dem record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;

  -- réservé à l'agence (admin ou opérateur)
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- la conversion se fait via convertir_demande_en_cession()
  if p_statut = 'convertie' then
    raise exception 'Utilisez « Convertir en cession » pour ce statut.';
  end if;
  if v_dem.statut = 'convertie' then
    raise exception 'Cette demande a déjà été convertie en cession.';
  end if;

  update demandes_acquisition
  set statut = p_statut,
      note_agence = coalesce(nullif(btrim(p_note), ''), note_agence),
      traite_par = auth.uid(),
      maj_le = now()
  where id = p_demande_id;
end;
$function$;

revoke all on function public.maj_statut_demande_acquisition(uuid, public.statut_demande_acquisition, text) from public;
grant execute on function public.maj_statut_demande_acquisition(uuid, public.statut_demande_acquisition, text) to authenticated;

-- 6. RPC — conversion en cession : crée l'attributaire acquéreur puis délègue à
--    creer_cession() (qui vérifie elle-même le rôle admin/opérateur et le tarif).
create or replace function public.convertir_demande_en_cession(
  p_demande_id  uuid,
  p_date_cession date default current_date,
  p_moyen        moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dem      record;
  v_attr_id  uuid;
  v_res      jsonb;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;

  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  if v_dem.statut = 'convertie' then
    raise exception 'Cette demande a déjà été convertie en cession.';
  end if;
  if v_dem.statut in ('refusee','annulee') then
    raise exception 'Impossible de convertir une demande refusée ou annulée.';
  end if;

  -- crée l'attributaire acquéreur (personne physique) à partir de l'identité captée
  insert into attributaires (nom, type, telephone, cree_par)
  values (v_dem.acquereur_nom, 'personne_physique', v_dem.acquereur_telephone, auth.uid())
  returning id into v_attr_id;

  -- délègue la cascade (cession + attribution + paiement) à la RPC existante
  v_res := public.creer_cession(
    v_dem.lot_id,
    v_attr_id,
    coalesce(p_date_cession, current_date),
    'Cession issue de la demande d''acquisition ' || p_demande_id::text,
    p_moyen
  );

  update demandes_acquisition
  set statut = 'convertie',
      attributaire_id = v_attr_id,
      cession_id = (v_res->>'cession_id')::uuid,
      traite_par = auth.uid(),
      maj_le = now()
  where id = p_demande_id;

  return v_res || jsonb_build_object('demande_id', p_demande_id, 'attributaire_id', v_attr_id);
end;
$function$;

revoke all on function public.convertir_demande_en_cession(uuid, date, moyen_paiement) from public;
grant execute on function public.convertir_demande_en_cession(uuid, date, moyen_paiement) to authenticated;

-- 7. Vue pratique pour la file agence : demande + libellés lot/lotissement.
create or replace view public.demandes_acquisition_agence
with (security_invoker = true) as
  select
    d.*,
    l.numero_lot,
    i.numero      as ilot_numero,
    lo.nom        as lotissement,
    lo.village,
    lo.commune,
    pr.nom_complet as demandeur_nom_complet
  from demandes_acquisition d
  join lots l on l.id = d.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  left join profiles pr on pr.id = d.demandeur_profile_id;

grant select on public.demandes_acquisition_agence to authenticated;
