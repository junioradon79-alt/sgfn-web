-- PV de bornage généré — même mécanique QR-vérifiable que les attestations de
-- cession (score de confiance, generation-document, verifier_document), mais
-- rattaché à une mission (missions_geometre) plutôt qu'à un lot du registre :
-- un bornage reste opposable même quand la parcelle n'est pas dans notre base.

alter type public.type_document add value if not exists 'pv_bornage';

create type public.statut_pv_bornage as enum ('generee', 'delivree', 'revoquee');

create sequence public.seq_pv_bornage;

create table public.pv_bornage (
  id uuid primary key default extensions.uuid_generate_v4(),
  mission_id uuid not null references public.missions_geometre(id),
  reference text not null unique,
  qr_token text unique,
  statut public.statut_pv_bornage not null default 'generee',
  date_bornage date,
  superficie_mesuree_m2 numeric,
  observations text,
  sig_demandeur_le timestamptz,
  sig_geometre_le timestamptz,
  sig_autorite_le timestamptz,
  cree_le timestamptz not null default now(),
  delivree_le timestamptz
);

alter table public.pv_bornage enable row level security;

-- Triggers génériques déjà en place pour les autres documents QR (attestations,
-- certificats...) — aucune nouvelle fonction trigger, on les rattache tels quels.
create trigger trg_qr_token_pv_bornage
  before insert on public.pv_bornage
  for each row execute function public.generer_qr_token();

create trigger trg_gen_pv_bornage
  after insert on public.pv_bornage
  for each row execute function public.sgfn_trigger_generation();

create policy pv_bornage_owner_all on public.pv_bornage for all
  using (mission_id in (select id from public.missions_geometre where geometre_id = mon_geometre_id()))
  with check (mission_id in (select id from public.missions_geometre where geometre_id = mon_geometre_id()));

create policy pv_bornage_admin_all on public.pv_bornage for all
  using (est_admin())
  with check (est_admin());

create index idx_pv_bornage_mission_id on public.pv_bornage(mission_id);

-- Génère le PV : vérifie que l'appelant est admin ou le géomètre propriétaire
-- de la mission, calcule la référence (même forme que ATT-CESS-...), insère.
create or replace function public.generer_pv_bornage(
  p_mission_id uuid,
  p_date_bornage date,
  p_superficie_mesuree_m2 numeric,
  p_observations text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_geometre_id uuid;
  v_ref text;
  v_id uuid;
begin
  select geometre_id into v_geometre_id from missions_geometre where id = p_mission_id;
  if v_geometre_id is null then
    raise exception 'Mission introuvable.';
  end if;
  if not est_admin() and v_geometre_id <> mon_geometre_id() then
    raise exception 'Non autorise.';
  end if;

  v_ref := 'PV-BORNAGE-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_pv_bornage'))::text, 5, '0');

  insert into pv_bornage (mission_id, reference, date_bornage, superficie_mesuree_m2, observations)
  values (p_mission_id, v_ref, p_date_bornage, p_superficie_mesuree_m2, p_observations)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.generer_pv_bornage(uuid, date, numeric, text) from public;
grant execute on function public.generer_pv_bornage(uuid, date, numeric, text) to authenticated;

-- Vérification publique : même modèle que les branches attestation_cession /
-- certificat_vente / apfc déjà présentes dans verifier_document().
create or replace function public.verifier_document(p_ref text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if exists (select 1 from attestations_cession where reference = p_ref or qr_token = p_ref) then
    select jsonb_build_object('type_document', 'attestation_cession') || public.verifier_attestation(p_ref) into v_result;
    return v_result;
  end if;

  if exists (select 1 from certificats_vente where reference = p_ref or qr_token = p_ref) then
    return (
      with cv as (select * from certificats_vente where reference = p_ref or qr_token = p_ref),
      lot as (select l.* from lots l join cv on cv.lot_id = l.id)
      select jsonb_build_object(
        'type_document', 'certificat_vente',
        'reference', (select reference from cv),
        'statut_document', (select statut from cv),
        'acquereur', (select nom from attributaires where id = (select acquereur_id from cv)),
        'lot', (select numero_lot from lot),
        'ilot', (select i.numero from ilots i join lot on lot.ilot_id = i.id),
        'statut_litige', coalesce((select statut::text from litiges where lot_id = (select id from lot) and statut <> 'clos' limit 1), 'aucun'),
        'score_confiance', public.score_confiance_lot((select id from lot))
      )
    );
  end if;

  if exists (select 1 from attestations_coutumieres where reference = p_ref or numero = p_ref) then
    return (
      with apfc as (select * from attestations_coutumieres where reference = p_ref or numero = p_ref),
      lo as (select lt.* from lotissements lt join apfc on apfc.lotissement_id = lt.id)
      select jsonb_build_object(
        'type_document', 'apfc',
        'reference', (select reference from apfc),
        'statut_document', (select statut::text from apfc),
        'date_delivrance', (select date_delivrance from apfc),
        'non_contestation_imprimee', (select non_contestation from apfc),
        'lotissement', (select nom from lo),
        'village', (select village from lo),
        'commune', (select commune from lo),
        'district', (select district from lo),
        'superficie', (select superficie_texte from lo),
        'nb_ilots', (select nb_ilots from lo),
        'nb_lots', (select nb_lots from lo),
        'famille', (select nom from familles where id = (select famille_id from apfc)),
        'lignee', (select f2.nom from familles f2 where f2.id = (select lignee_id from familles where id = (select famille_id from apfc))),
        'chef_de_famille', coalesce((select chef_de_famille from apfc), (select chef_de_famille from familles where id = (select famille_id from apfc))),
        'autorite_coutumiere', (select nom from autorites_coutumieres where id = (select autorite_coutumiere_id from apfc)),
        'autorite_chef', (select chef from autorites_coutumieres where id = (select autorite_coutumiere_id from apfc)),
        'guide_reference', (select lo.guide_reference from lo),
        'guide_page_min', (select min(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'guide_page_max', (select max(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'pv_numero_enregistrement', (select pv_numero_enregistrement from lo),
        'pv_commissaire_nom', (select nom from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'pv_commissaire_etude', (select etude from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'litiges_actifs', (
          select coalesce(jsonb_agg(jsonb_build_object('lot', l2.numero_lot, 'ilot', i2.numero, 'objet', lit.objet, 'statut', lit.statut, 'ouvert_le', lit.ouvert_le)), '[]'::jsonb)
          from litiges lit
          join lots l2 on l2.id = lit.lot_id
          join ilots i2 on i2.id = l2.ilot_id
          where i2.lotissement_id = (select id from lo) and lit.statut <> 'clos'
        ),
        'nb_attestations_emises', (select count(*) from attestations_cession where apfc_id = (select id from apfc))
      )
    );
  end if;

  if exists (select 1 from pv_bornage where reference = p_ref or qr_token = p_ref) then
    return (
      with pv as (select * from pv_bornage where reference = p_ref or qr_token = p_ref),
      m as (select * from missions_geometre where id = (select mission_id from pv)),
      ge as (select * from geometres_experts where id = (select geometre_id from m)),
      lot as (select * from lots where id = (select lot_id from m))
      select jsonb_build_object(
        'type_document', 'pv_bornage',
        'reference', (select reference from pv),
        'statut_document', (select statut::text from pv),
        'geometre', (select nom from ge),
        'geometre_cabinet', (select cabinet from ge),
        'geometre_numero_ordre', (select numero_ordre from ge),
        'client', (select client_nom from m),
        'lieu', (select lieu from m),
        'lot', (select numero_lot from lot),
        'date_bornage', (select date_bornage from pv),
        'superficie_mesuree_m2', (select superficie_mesuree_m2 from pv),
        'superficie_enregistree_m2', (select superficie_m2 from lot),
        'sig_demandeur', (select sig_demandeur_le is not null from pv),
        'sig_geometre', (select sig_geometre_le is not null from pv),
        'sig_autorite', (select sig_autorite_le is not null from pv)
      )
    );
  end if;

  return jsonb_build_object('type_document', null);
end;
$function$;
