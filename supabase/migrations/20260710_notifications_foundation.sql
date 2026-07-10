-- Fondation notifications (10/07/2026) — canal WhatsApp Cloud API (Meta).
--
-- Règle de plateforme (décidée par le user) : chaque événement notifie le(s)
-- utilisateur(s) qu'il concerne, sur SON propre numéro (profiles.telephone).
-- Pas de numéro central. Un opérateur ne reçoit que ce qui touche SES lotissements.
--
-- Architecture INERTE et sûre :
--   1. Table `notifications` = file durable.
--   2. Triggers AFTER INSERT sur les tables métier (demandes/ventes/certificats/
--      attestations) → enfilent une notification par destinataire concerné.
--      TOUT est enveloppé dans des gardes d'exception : une notif ne doit JAMAIS
--      bloquer une vente.
--   3. Un trigger de dispatch appelle l'edge `envoyer-whatsapp` (sgfn_call_edge,
--      pg_net = enqueue transactionnel). L'edge est fail-closed : sans les secrets
--      Meta (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID) rien ne part, la notif
--      reste `en_attente`. Zéro impact tant que Meta n'est pas configuré.

-- 1. Enums + table
do $$ begin
  if not exists (select 1 from pg_type where typname = 'canal_notification') then
    create type canal_notification as enum ('whatsapp', 'email', 'sms');
  end if;
  if not exists (select 1 from pg_type where typname = 'statut_notification') then
    create type statut_notification as enum ('en_attente', 'envoye', 'echoue', 'ignore');
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_profile_id uuid not null references public.profiles(id) on delete cascade,
  canal   canal_notification  not null default 'whatsapp',
  type    text                not null,
  params  jsonb               not null default '{}'::jsonb,
  statut  statut_notification not null default 'en_attente',
  reference_table text,
  reference_id    uuid,
  erreur  text,
  cree_le   timestamptz not null default now(),
  envoye_le timestamptz
);
create index if not exists idx_notifications_file on public.notifications (statut, canal);
create index if not exists idx_notifications_dest on public.notifications (destinataire_profile_id, cree_le desc);

alter table public.notifications enable row level security;
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications
  for select using (destinataire_profile_id = auth.uid() or public.est_admin());
-- Aucune policy insert/update pour `authenticated` : écritures via fonctions
-- SECURITY DEFINER (triggers) et service_role (edge fn) uniquement.
grant select on public.notifications to authenticated;

-- 2. Helpers de résolution

-- Profil (utilisateur) rattaché à un attributaire (acquéreur, propriétaire…).
create or replace function public.profil_de_attributaire(p_attr uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.profiles where attributaire_id = p_attr limit 1;
$$;

-- « Agence » concernée par un lot = admin + opérateur du lotissement + chefferie
-- de la famille (même périmètre que la RLS da_agence_read).
create or replace function public.destinataires_agence_lot(p_lot_id uuid)
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select distinct p.id
  from public.profiles p
  join public.lots l on l.id = p_lot_id
  join public.ilots i on i.id = l.ilot_id
  join public.lotissements lo on lo.id = i.lotissement_id
  where p.groupe = 'admin'
     or (p.groupe = 'operateur' and p.operateur_id is not null and p.operateur_id = lo.operateur_id)
     or (p.groupe = 'chefferie' and p.famille_id is not null and p.famille_id = lo.famille_id);
$$;

-- Libellé « humain » d'un lot pour les messages.
create or replace function public.lot_libelle(p_lot_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'lot', 'Lot ' || coalesce(l.numero_lot, '?') || ' · Îlot ' || coalesce(i.numero, '?'),
    'lieu', concat_ws(' · ', lo.nom, lo.village, lo.commune)
  )
  from public.lots l
  join public.ilots i on i.id = l.ilot_id
  join public.lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;
$$;

-- Enfile une notification (ignore si le destinataire est nul).
create or replace function public.enqueue_notification(
  p_profil uuid,
  p_type   text,
  p_params jsonb,
  p_ref_table text default null,
  p_ref_id    uuid default null,
  p_canal  canal_notification default 'whatsapp'
)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_profil is null then return; end if;
  insert into public.notifications (destinataire_profile_id, canal, type, params, reference_table, reference_id)
  values (p_profil, p_canal, p_type, coalesce(p_params, '{}'::jsonb), p_ref_table, p_ref_id);
end;
$$;

-- 3. Triggers métier (AFTER INSERT) — chacun protégé : jamais bloquant.

create or replace function public.notif_demande_acquisition()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_info jsonb; v_prof uuid;
begin
  begin
    v_info := public.lot_libelle(new.lot_id);
    for v_prof in select * from public.destinataires_agence_lot(new.lot_id) loop
      perform public.enqueue_notification(
        v_prof, 'agence_nouvelle_demande',
        v_info || jsonb_build_object('action', 'Nouvelle demande d''acquisition'),
        'demandes_acquisition', new.id);
    end loop;
  exception when others then null;
  end;
  return new;
end;
$$;

create or replace function public.notif_vente()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_prof uuid;
begin
  begin
    v_prof := public.profil_de_attributaire(new.acquereur_id);
    perform public.enqueue_notification(
      v_prof, 'acquereur_vente_creee',
      public.lot_libelle(new.lot_id) || jsonb_build_object(
        'etape', 'Votre achat est enregistré',
        'complement', 'Réglez votre terrain dans votre espace SGNF.'),
      'ventes', new.id);
  exception when others then null;
  end;
  return new;
end;
$$;

create or replace function public.notif_certificat_vente()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_info jsonb; v_prof uuid;
begin
  begin
    v_info := public.lot_libelle(new.lot_id);
    -- Acquéreur : « vous êtes propriétaire »
    perform public.enqueue_notification(
      public.profil_de_attributaire(new.acquereur_id), 'acquereur_certificat',
      v_info || jsonb_build_object(
        'etape', 'Félicitations, vous êtes propriétaire',
        'complement', 'Votre certificat de vente est disponible dans votre espace SGNF.'),
      'certificats_vente', new.id);
    -- Agence : attestation de cession à facturer
    for v_prof in select * from public.destinataires_agence_lot(new.lot_id) loop
      perform public.enqueue_notification(
        v_prof, 'agence_attestation_a_facturer',
        v_info || jsonb_build_object('action', 'Vente soldée — attestation à facturer'),
        'certificats_vente', new.id);
    end loop;
  exception when others then null;
  end;
  return new;
end;
$$;

create or replace function public.notif_attestation_cession()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    perform public.enqueue_notification(
      public.profil_de_attributaire(new.acquereur_id), 'acquereur_attestation_prete',
      public.lot_libelle(new.lot_id) || jsonb_build_object(
        'etape', 'Votre attestation est prête',
        'complement', 'Retrouvez-la dans votre espace SGNF, rubrique Documents.'),
      'attestations_cession', new.id);
  exception when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notif_demande on public.demandes_acquisition;
create trigger trg_notif_demande after insert on public.demandes_acquisition
  for each row execute function public.notif_demande_acquisition();

drop trigger if exists trg_notif_vente on public.ventes;
create trigger trg_notif_vente after insert on public.ventes
  for each row execute function public.notif_vente();

drop trigger if exists trg_notif_certificat on public.certificats_vente;
create trigger trg_notif_certificat after insert on public.certificats_vente
  for each row execute function public.notif_certificat_vente();

drop trigger if exists trg_notif_attestation on public.attestations_cession;
create trigger trg_notif_attestation after insert on public.attestations_cession
  for each row execute function public.notif_attestation_cession();

-- 4. Dispatch : appelle l'edge WhatsApp (fail-closed). Jamais bloquant.
create or replace function public.notif_dispatch()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.canal = 'whatsapp' then
    begin
      perform public.sgfn_call_edge('envoyer-whatsapp', jsonb_build_object('notification_id', new.id));
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notif_dispatch on public.notifications;
create trigger trg_notif_dispatch after insert on public.notifications
  for each row execute function public.notif_dispatch();
