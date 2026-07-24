-- Modules internes SGNF : Comptabilité simplifiée + RH (annuaire collaborateurs).
-- Demandé le 24/07 — usage interne uniquement, accès admin + comptable.
--
-- Comptabilité : pas de grand livre en partie double. Les recettes sont déjà
-- connues (table `paiements`, statut='confirme', colonne `commission_sgfn` =
-- la part réellement encaissée par SGNF, cf. mémoire tarification_paliers_cession) ;
-- seules les dépenses manquaient une table. RH : simple annuaire, sans lien
-- avec les comptes `profiles` — un collaborateur n'a pas forcément de compte
-- applicatif.

-- 1. Fonction de garde, même forme que est_admin().
create or replace function public.est_comptable()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists(select 1 from profiles where id = auth.uid() and groupe = 'comptable');
$function$;

-- 2. Comptabilité — dépenses saisies à la main (les recettes viennent de
--    `paiements`, lu directement par la page).
create type public.categorie_depense as enum (
  'salaires',
  'loyer_charges',
  'materiel_equipement',
  'prestataires_externes',
  'marketing_communication',
  'impots_taxes',
  'deplacements',
  'autre'
);

create table public.depenses (
  id uuid primary key default gen_random_uuid(),
  date_depense date not null default current_date,
  categorie public.categorie_depense not null,
  description text not null,
  montant numeric not null check (montant > 0),
  saisi_par uuid references public.profiles(id),
  cree_le timestamptz not null default now()
);

alter table public.depenses enable row level security;

create policy depenses_gestion on public.depenses
  for all
  using (est_admin() or est_comptable())
  with check (est_admin() or est_comptable());

-- Lecture des recettes confirmées : la policy existante `paiements_admin_all`
-- couvre déjà admin ; comptable n'avait aucun accès à `paiements`.
create policy paiements_read_comptable on public.paiements
  for select
  using (est_comptable());

-- 3. RH — annuaire simple des collaborateurs internes.
create table public.collaborateurs (
  id uuid primary key default gen_random_uuid(),
  nom_complet text not null,
  poste text,
  service text,
  email text,
  telephone text,
  date_entree date,
  date_sortie date,
  statut text not null default 'actif' check (statut in ('actif', 'inactif')),
  notes text,
  cree_par uuid references public.profiles(id),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

alter table public.collaborateurs enable row level security;

create policy collaborateurs_gestion on public.collaborateurs
  for all
  using (est_admin() or est_comptable())
  with check (est_admin() or est_comptable());

create or replace function public.trg_maj_modifie_collaborateur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger collaborateurs_maj_modifie
before update on public.collaborateurs
for each row execute function public.trg_maj_modifie_collaborateur();
