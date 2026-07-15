-- Onboarding self-service géomètre-expert (dette #14 du document directeur) :
-- demande publique -> validation admin -> invitation groupe='geometre' auto-générée
-- -> inscription via /inscription (flux existant, inchangé) -> compte lié
-- automatiquement à la fiche registre, sans intervention manuelle admin.
--
-- Aucun groupe n'est auto-attribuable côté client : handle_new_user() (voir
-- 20260715100000_fix_handle_new_user_groupe_from_invitation.sql) ne lit le groupe que
-- depuis une invitation valide en base.

-- Table des demandes d'inscription geometre (self-service, avant validation admin)
create table public.demandes_inscription_geometre (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  numero_ordre text,
  cabinet text,
  telephone text not null,
  email text,
  message text,
  statut text not null default 'en_attente' check (statut in ('en_attente','approuvee','rejetee')),
  invitation_id uuid references public.invitations(id),
  traite_par uuid references public.profiles(id),
  traite_le timestamptz,
  cree_le timestamptz not null default now()
);

alter table public.demandes_inscription_geometre enable row level security;

create policy demandes_geometre_admin_all on public.demandes_inscription_geometre
for all
using (est_admin())
with check (est_admin());

-- Lien invitation -> fiche geometre (meme famille que attributaire_id/commissaire_id/autorite_coutumiere_id/famille_id)
alter table public.invitations
  add column geometre_id uuid references public.geometres_experts(id);

-- handle_new_user() propage aussi geometre_id depuis l'invitation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invitation_id uuid;
  v_groupe groupe_utilisateur;
  v_attributaire_id uuid;
  v_commissaire_id uuid;
  v_autorite_coutumiere_id uuid;
  v_famille_id uuid;
  v_geometre_id uuid;
begin
  if new.raw_user_meta_data->>'code_invitation' is not null then
    select id, groupe, attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, geometre_id
      into v_invitation_id, v_groupe, v_attributaire_id, v_commissaire_id, v_autorite_coutumiere_id, v_famille_id, v_geometre_id
    from public.invitations
    where code = new.raw_user_meta_data->>'code_invitation'
      and statut = 'en_attente'
      and expire_le > now();
  end if;

  insert into public.profiles (
    id, nom_complet, telephone, groupe,
    attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, geometre_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', new.email, new.phone, 'Utilisateur'),
    coalesce(new.raw_user_meta_data->>'telephone', new.phone),
    coalesce(v_groupe, 'acquereur'),
    v_attributaire_id,
    v_commissaire_id,
    v_autorite_coutumiere_id,
    v_famille_id,
    v_geometre_id
  )
  on conflict (id) do nothing;

  if v_invitation_id is not null then
    update public.invitations
    set statut = 'utilisee', utilisee_le = now(), utilisee_par = new.id
    where id = v_invitation_id;
  end if;

  return new;
end;
$function$;

-- RPC publique : soumettre une demande d'inscription geometre
create or replace function public.demander_inscription_geometre(
  p_nom text,
  p_numero_ordre text default null,
  p_cabinet text default null,
  p_telephone text default null,
  p_email text default null,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if btrim(coalesce(p_nom, '')) = '' then
    raise exception 'Le nom complet est obligatoire.';
  end if;
  if btrim(coalesce(p_telephone, '')) = '' then
    raise exception 'Le téléphone est obligatoire.';
  end if;

  insert into public.demandes_inscription_geometre (nom, numero_ordre, cabinet, telephone, email, message)
  values (
    left(btrim(p_nom), 200),
    nullif(left(btrim(coalesce(p_numero_ordre, '')), 50), ''),
    nullif(left(btrim(coalesce(p_cabinet, '')), 200), ''),
    left(btrim(p_telephone), 30),
    nullif(left(btrim(coalesce(p_email, '')), 200), ''),
    nullif(left(btrim(coalesce(p_message, '')), 1000), '')
  )
  returning id into v_id;

  return v_id;
end;
$function$;

grant execute on function public.demander_inscription_geometre(text, text, text, text, text, text) to anon, authenticated;

-- RPC admin : approuver une demande -> cree la fiche registre + une invitation groupe=geometre
create or replace function public.approuver_demande_geometre(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_d record;
  v_geometre_id uuid;
  v_invitation record;
begin
  if not public.est_admin() then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select * into v_d from demandes_inscription_geometre where id = p_id for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if v_d.statut <> 'en_attente' then
    raise exception 'Demande déjà traitée (%).', v_d.statut;
  end if;

  insert into public.geometres_experts (nom, numero_ordre, cabinet, contact)
  values (v_d.nom, v_d.numero_ordre, v_d.cabinet, coalesce(v_d.telephone, v_d.email))
  returning id into v_geometre_id;

  insert into public.invitations (groupe, geometre_id, nom_complet, email, telephone, cree_par)
  values ('geometre', v_geometre_id, v_d.nom, v_d.email, v_d.telephone, auth.uid())
  returning * into v_invitation;

  update demandes_inscription_geometre
  set statut = 'approuvee',
      invitation_id = v_invitation.id,
      traite_par = auth.uid(),
      traite_le = now()
  where id = p_id;

  return jsonb_build_object('code', v_invitation.code, 'expire_le', v_invitation.expire_le, 'geometre_id', v_geometre_id);
end;
$function$;

grant execute on function public.approuver_demande_geometre(uuid) to anon, authenticated;

-- RPC admin : rejeter une demande
create or replace function public.rejeter_demande_geometre(p_id uuid, p_motif text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_d record;
begin
  if not public.est_admin() then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select * into v_d from demandes_inscription_geometre where id = p_id for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if v_d.statut <> 'en_attente' then
    raise exception 'Demande déjà traitée (%).', v_d.statut;
  end if;

  update demandes_inscription_geometre
  set statut = 'rejetee',
      traite_par = auth.uid(),
      traite_le = now()
  where id = p_id;
end;
$function$;

grant execute on function public.rejeter_demande_geometre(uuid, text) to anon, authenticated;
