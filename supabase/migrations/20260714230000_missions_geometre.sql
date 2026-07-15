-- Portefeuille multi-clients du géomètre-expert.
--
-- `demarches` (livré ce soir) est admin-centrique : créée par l'admin, toujours
-- rattachée à un lot déjà dans notre registre. Un cabinet réel a aussi des
-- missions pour des clients hors plateforme (particuliers, autres aménageurs)
-- qui n'existent pas dans notre base — d'où une table séparée, en libre
-- gestion par le géomètre, avec `lot_id` optionnel plutôt qu'obligatoire.

create type public.type_mission_geometre as enum (
  'bornage', 'morcellement', 'implantation', 'expertise_judiciaire',
  'leve_topographique', 'immatriculation', 'copropriete', 'autre'
);

create type public.statut_mission_geometre as enum (
  'en_preparation', 'en_cours', 'terminee', 'annulee'
);

create table public.missions_geometre (
  id uuid primary key default extensions.uuid_generate_v4(),
  geometre_id uuid not null references public.geometres_experts(id),
  type_mission public.type_mission_geometre not null,
  client_nom text not null,
  client_contact text,
  lieu text,
  lot_id uuid references public.lots(id),
  statut public.statut_mission_geometre not null default 'en_preparation',
  montant_honoraires numeric,
  montant_recu numeric,
  description text,
  ouverte_le timestamptz not null default now(),
  terminee_le timestamptz,
  cree_le timestamptz not null default now(),
  cree_par uuid references public.profiles(id)
);

alter table public.missions_geometre enable row level security;

-- Même esprit que mon_attributaire_id()/mon_operateur_id() : résout le
-- géomètre-expert lié au compte connecté, pour scoper la RLS de sa table.
create or replace function public.mon_geometre_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select geometre_id from profiles where id = (select auth.uid());
$function$;

revoke all on function public.mon_geometre_id() from public;
grant execute on function public.mon_geometre_id() to authenticated;

create policy missions_geometre_owner_all on public.missions_geometre for all
  using (geometre_id = mon_geometre_id())
  with check (geometre_id = mon_geometre_id());

create policy missions_geometre_admin_all on public.missions_geometre for all
  using (est_admin())
  with check (est_admin());

create index idx_missions_geometre_geometre_id on public.missions_geometre(geometre_id);
create index idx_missions_geometre_lot_id on public.missions_geometre(lot_id) where lot_id is not null;
