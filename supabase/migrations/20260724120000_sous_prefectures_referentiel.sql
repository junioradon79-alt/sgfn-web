-- Référentiel géographique national : sous-préfectures et communes de
-- Côte d'Ivoire, à distinguer explicitement des chefferies coutumières de
-- `autorites_coutumieres` — une sous-préfecture est une circonscription de
-- l'État (article de la loi n° 2014-451 du 05/08/2014), pas une autorité
-- traditionnelle. Demandé le 24/07 en complément du travail sur les
-- chefferies, pour couvrir tout le territoire (pas seulement Abidjan/
-- Yamoussoukro/districts du Sud).
--
-- Source : jeu de données officiel « Liste des circonscriptions
-- administratives et des communes de la Côte d'Ivoire », producteur
-- Ministère de l'Intérieur et de l'Intégration Nationale, publié sur le
-- portail data.gouv.ci (data-fair), 252 enregistrements. Chaque ligne =
-- 1 sous-préfecture, avec sa commune de plein exercice quand elle existe
-- (`commune` est NULL pour ~54 sous-préfectures rurales qui n'ont pas ce
-- statut). Seule exception : Abidjan, dont les 10 communes partagent la
-- même ligne "sous-préfecture" dans ce jeu de données.
--
-- ⚠️ Le champ `region` reprend tel quel le libellé du jeu de données
-- ministériel, qui utilise encore le découpage en 19 régions historiques
-- (ex. « Lagunes », « Agneby », « Baffing », « Sud-Bandama ») antérieur au
-- redécoupage de 2011 en 31 régions / 14 districts. Il ne faut donc PAS lire
-- ce champ comme le district actuel (ex. Abidjan y apparaît sous la région
-- « Lagunes », alors qu'il est aujourd'hui son propre District Autonome).
-- `departement` et `nom` (sous-préfecture), en revanche, restent des unités
-- stables dans le temps.

create table public.sous_prefectures (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  departement text,
  region text,
  chef_lieu_departement text,
  commune text,
  cree_le timestamptz not null default now()
);

comment on table public.sous_prefectures is
  'Référentiel géographique (sous-préfectures + communes de plein exercice), source Ministère de l''Intérieur — distinct des chefferies coutumières (autorites_coutumieres).';
comment on column public.sous_prefectures.region is
  'Libellé région tel que publié par le ministère (nomenclature à 19 régions antérieure à 2011) — ne pas confondre avec les 14 districts/31 régions actuels.';

alter table public.sous_prefectures enable row level security;

create policy sous_prefectures_lecture_authentifies
  on public.sous_prefectures for select
  to authenticated
  using (true);

create policy sous_prefectures_admin_ecriture
  on public.sous_prefectures for all
  to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and groupe = 'admin'::groupe_utilisateur))
  with check (exists (select 1 from public.profiles where id = (select auth.uid()) and groupe = 'admin'::groupe_utilisateur));
