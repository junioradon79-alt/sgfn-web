-- Suite du module Comptabilité + RH (24/07), deux ajouts demandés par le user :
--
-- 1. Comptabilité — rubrique « Entrée » saisie à la main (apports en numéraire /
--    capital reçus avant encaissement des commissions). Table dédiée `apports`,
--    symétrique de `depenses`, mais tenue À PART des recettes commissions dans
--    les KPI (décision user) : elle alimente le solde de trésorerie, pas le
--    chiffre d'affaires.
--
-- 2. RH — identifiants de connexion par collaborateur, pour qu'il accède à sa
--    propre fiche (lecture seule) + Messages. Réutilise le système
--    d'invitation existant (comme familles/autorités coutumières) plutôt qu'un
--    mécanisme dédié. Nouveau rôle minimal `collaborateur` (migration
--    précédente 20260724190000).

-- 1. Comptabilité — apports (entrées manuelles hors commissions).
create type public.categorie_apport as enum (
  'apport_capital',
  'pret_associe',
  'subvention',
  'autre'
);

create table public.apports (
  id uuid primary key default gen_random_uuid(),
  date_apport date not null default current_date,
  categorie public.categorie_apport not null,
  description text not null,
  montant numeric not null check (montant > 0),
  saisi_par uuid references public.profiles(id),
  cree_le timestamptz not null default now()
);

alter table public.apports enable row level security;

create policy apports_gestion on public.apports
  for all
  using (est_admin() or est_comptable())
  with check (est_admin() or est_comptable());

-- 2. RH — lien collaborateur ↔ compte applicatif, même convention que
--    profiles.famille_id / profiles.autorite_coutumiere_id (FK portée par
--    profiles, pas par la table cible). Un collaborateur a au plus un compte.
alter table public.profiles
  add column collaborateur_id uuid references public.collaborateurs(id);

create unique index profiles_collaborateur_id_key
  on public.profiles (collaborateur_id)
  where collaborateur_id is not null;

-- L'invitation porte le rattachement, comme pour chefferie/propriétaire terrien.
alter table public.invitations
  add column collaborateur_id uuid references public.collaborateurs(id);

-- Repart de la version courante de la contrainte (20260723190000, qui a
-- interdit attributaire_id sur les invitations acquéreur — cf. mémoire
-- bug_acquereur_herite_attributaire_invitation), pas de l'ancienne version
-- d'origine : juste ajouter le volet collaborateur.
alter table public.invitations drop constraint invitations_check;

alter table public.invitations add constraint invitations_check check (
  (groupe <> 'proprietaire'::groupe_utilisateur or attributaire_id is not null)
  and (groupe <> 'acquereur'::groupe_utilisateur or attributaire_id is null)
  and (statut <> 'en_attente' or groupe <> 'chefferie'::groupe_utilisateur
    or autorite_coutumiere_id is not null or famille_id is not null)
  and (statut <> 'en_attente' or groupe <> 'proprietaire_terrien'::groupe_utilisateur
    or famille_id is not null)
  and (statut <> 'en_attente' or groupe <> 'collaborateur'::groupe_utilisateur
    or collaborateur_id is not null)
);

-- handle_new_user() : même fonction que le correctif du 15/07
-- (fix_handle_new_user_groupe_from_invitation), avec collaborateur_id en plus
-- dans le même mécanisme que famille_id/autorite_coutumiere_id.
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
  v_collaborateur_id uuid;
begin
  if new.raw_user_meta_data->>'code_invitation' is not null then
    select id, groupe, attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, collaborateur_id
      into v_invitation_id, v_groupe, v_attributaire_id, v_commissaire_id, v_autorite_coutumiere_id, v_famille_id, v_collaborateur_id
    from public.invitations
    where code = new.raw_user_meta_data->>'code_invitation'
      and statut = 'en_attente'
      and expire_le > now();
  end if;

  insert into public.profiles (
    id, nom_complet, telephone, groupe,
    attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, collaborateur_id
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
    v_collaborateur_id
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

-- Un collaborateur lit sa propre fiche, en lecture seule (aucune policy
-- update/delete pour ce rôle : `collaborateurs_gestion` reste admin/comptable).
create or replace function public.mon_collaborateur_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select collaborateur_id from public.profiles where id = auth.uid();
$function$;

create policy collaborateurs_lecture_soi on public.collaborateurs
  for select
  using (id = mon_collaborateur_id());

-- Petit helper pour la page RH (badge « Accès activé ») : indique quels
-- collaborateurs ont déjà un compte, sans exposer toute la table `profiles`
-- (qui contient téléphones/emails d'autres rôles) à `comptable`. Le filtre
-- est fait DANS la fonction, pas dans la policy appelante, donc un appel par
-- un rôle non autorisé renvoie un ensemble vide plutôt qu'une erreur.
create or replace function public.collaborateurs_avec_compte()
returns setof uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select collaborateur_id from public.profiles
  where collaborateur_id is not null
    and (est_admin() or est_comptable());
$function$;
