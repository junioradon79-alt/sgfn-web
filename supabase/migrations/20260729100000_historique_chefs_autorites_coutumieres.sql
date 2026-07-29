-- Historique des chefs d'autorité coutumière — un document est signé par le chef
-- EN FONCTION À SA DATE, pas par celui d'aujourd'hui.
--
-- 🔴 LE DÉFAUT. `autorites_coutumieres.chef` est une colonne unique qui porte le
-- chef COURANT. `verifier_document` la lit telle quelle et l'expose sur la page
-- publique /verifier sous le libellé « Chef ». Quand un chef est remplacé, tous
-- les documents passés de cette chefferie changent donc de signataire aux yeux
-- du public.
--
-- Prouvé en production le 29/07 :
--   verifier_document('APFC-EBIMPE-2022-001')
--     date_delivrance : 2022-02-10
--     autorite_chef   : HOBI MONDON ATSIN PACOME
--
-- Or l'APFC de Koelea-Accor a été signée par NANAN AFFA KOUACHY ALFRED, chef du
-- village d'Ebimpe à l'époque. Son successeur a été nommé par l'arrêté
-- 38/PA/SG/D1 du 12/05/2023 — quinze mois APRÈS la délivrance du document. La
-- page publique attribuait donc l'acte à quelqu'un qui n'était pas en fonction.
--
-- Ce n'est pas la faute de la mise à jour du 24/07 qui a inscrit le chef actuel :
-- c'est le modèle qui n'avait qu'une case pour deux faits distincts — « qui
-- dirige la chefferie aujourd'hui » et « qui a signé cet acte-là ». On sépare
-- les deux.

-- ── 1. L'historique ──────────────────────────────────────────────────────────
--
-- Une ligne par chef et par période. `debut`/`fin` sont NULLables et les deux
-- NULL ont un sens précis, volontairement différent :
--   debut IS NULL → en fonction depuis une date que le registre ne connaît pas
--   fin   IS NULL → toujours en fonction
-- On ne fabrique pas de date : un prédécesseur dont on ignore la prise de
-- fonction garde `debut` à NULL plutôt qu'une date inventée qui aurait l'air
-- d'une source.

create table if not exists public.chefs_autorites_coutumieres (
  id                       uuid primary key default gen_random_uuid(),
  autorite_coutumiere_id   uuid not null references public.autorites_coutumieres(id) on delete cascade,
  nom                      text not null,
  numero_arrete_nomination text,
  date_arrete              date,
  autorite_signataire      text,
  debut                    date,
  fin                      date,
  cree_le                  timestamptz not null default now(),
  constraint chefs_autorites_periode_coherente check (debut is null or fin is null or debut <= fin),
  constraint chefs_autorites_nom_non_vide      check (btrim(nom) <> '')
);

comment on table public.chefs_autorites_coutumieres is
  'Succession des chefs d''une autorité coutumière. `autorites_coutumieres.chef` reste le chef courant (affichage, nouveaux actes) ; cette table sert à retrouver le signataire d''un document à SA date. Voir chef_autorite_a_la_date().';
comment on column public.chefs_autorites_coutumieres.debut is
  'Prise de fonction. NULL = antérieure à ce que le registre sait — ne pas confondre avec une date inconnue fabriquée.';
comment on column public.chefs_autorites_coutumieres.fin is
  'Dernier jour de fonction (inclus). NULL = chef en fonction.';

create index if not exists chefs_autorites_par_autorite
  on public.chefs_autorites_coutumieres (autorite_coutumiere_id, debut);

-- Un seul chef en fonction à la fois par autorité.
create unique index if not exists chefs_autorites_un_seul_en_fonction
  on public.chefs_autorites_coutumieres (autorite_coutumiere_id)
  where fin is null;

-- ── 2. Garde anti-chevauchement ──────────────────────────────────────────────
--
-- `btree_gist` n'est pas installée sur ce projet (vérifié le 29/07), donc pas de
-- contrainte d'exclusion sur un `daterange`. Un trigger fait le même travail —
-- et il est écrit NULL-safe d'emblée : c'est exactement là que la garde du 28/07
-- s'était effondrée (une comparaison avec NULL ne refuse rien, elle vaut NULL).
-- Les bornes ouvertes sont donc converties en ±infinity AVANT toute comparaison,
-- jamais testées par `=` ou `<>`.

create or replace function public.chefs_autorites_sans_chevauchement()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_periode daterange;
  v_conflit text;
begin
  -- Cohérence des bornes AVANT de construire l'intervalle. La contrainte
  -- `chefs_autorites_periode_coherente` dit la même chose, mais les contraintes
  -- `check` sont évaluées APRÈS les triggers `before` : sans ce test, une
  -- période inversée fait échouer `daterange()` sur « range lower bound must be
  -- less than or equal to range upper bound », message qui ne dit pas à
  -- l'appelant ce qu'il a saisi de travers.
  if new.debut is not null and new.fin is not null and new.debut > new.fin then
    raise exception 'Periode incoherente : prise de fonction (%) posterieure a la fin (%).', new.debut, new.fin;
  end if;

  v_periode := daterange(
    coalesce(new.debut, '-infinity'::date),
    coalesce(new.fin + 1, 'infinity'::date),
    '[)'
  );

  select c.nom into v_conflit
  from chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id = new.autorite_coutumiere_id
    and c.id is distinct from new.id
    and daterange(
          coalesce(c.debut, '-infinity'::date),
          coalesce(c.fin + 1, 'infinity'::date),
          '[)'
        ) && v_periode
  limit 1;

  if v_conflit is not null then
    raise exception 'Periode en conflit avec le chef % deja enregistre pour cette autorite.', v_conflit;
  end if;

  return new;
end;
$function$;

drop trigger if exists chefs_autorites_sans_chevauchement on public.chefs_autorites_coutumieres;
create trigger chefs_autorites_sans_chevauchement
  before insert or update on public.chefs_autorites_coutumieres
  for each row execute function public.chefs_autorites_sans_chevauchement();

-- ── 3. RLS — calquée sur `autorites_coutumieres` ─────────────────────────────
--
-- Même portée que la table qu'elle prolonge : lecture pour tout compte connecté,
-- écriture réservée à l'admin. La page publique /verifier n'a pas besoin d'y
-- accéder directement — elle passe par `verifier_document`, SECURITY DEFINER.

alter table public.chefs_autorites_coutumieres enable row level security;

drop policy if exists chefs_autorites_read on public.chefs_autorites_coutumieres;
create policy chefs_autorites_read on public.chefs_autorites_coutumieres
  for select using ((select auth.uid()) is not null);

drop policy if exists chefs_autorites_admin_all on public.chefs_autorites_coutumieres;
create policy chefs_autorites_admin_all on public.chefs_autorites_coutumieres
  for all using (public.est_admin()) with check (public.est_admin());

-- ── 4. Peuplement ────────────────────────────────────────────────────────────
--
-- 4.a Les chefs COURANTS, repris du référentiel (26 autorités, une seule
--     renseignée à ce jour : Ebimpe). Écrit comme une reprise générique et non
--     comme un insert nommé, pour rester juste si le référentiel a bougé entre
--     l'écriture et l'application.

insert into public.chefs_autorites_coutumieres
  (autorite_coutumiere_id, nom, numero_arrete_nomination, date_arrete, autorite_signataire, debut, fin)
select ac.id, btrim(ac.chef), ac.numero_arrete_nomination, ac.date_arrete, ac.autorite_signataire,
       ac.date_arrete,   -- prise de fonction = date de l'arrêté quand elle est connue, sinon NULL
       null              -- en fonction
from public.autorites_coutumieres ac
where ac.chef is not null
  and btrim(ac.chef) <> ''
  and not exists (
    select 1 from public.chefs_autorites_coutumieres c
    where c.autorite_coutumiere_id = ac.id and c.fin is null
  );

-- 4.b Le prédécesseur d'Ebimpe.
--
-- Fait établi par le user (12/07/2026, reconfirmé le 29/07) : NANAN AFFA
-- KOUACHY ALFRED était chef du village d'Ebimpe et a signé l'APFC-EBIMPE-2022-001
-- de Koelea-Accor. Il n'est plus chef et n'a — volontairement — aucun compte sur
-- la plateforme : son nom ne doit rester attaché qu'à l'acte historique qu'il a
-- signé. C'est précisément ce que cette table permet, sans lui créer de profil.
--
-- `debut` NULL : sa prise de fonction n'est pas connue du registre.
-- `fin` = 2023-05-11 : déduite de l'arrêté 38/PA/SG/D1 du 12/05/2023 qui nomme
-- son successeur. C'est une déduction, pas une pièce — signalée comme telle.

insert into public.chefs_autorites_coutumieres (autorite_coutumiere_id, nom, debut, fin)
select 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid, 'NANAN AFFA KOUACHY ALFRED', null, date '2023-05-11'
where exists (
    select 1 from public.autorites_coutumieres
    where id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
  )
  and not exists (
    select 1 from public.chefs_autorites_coutumieres
    where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
      and nom = 'NANAN AFFA KOUACHY ALFRED'
  );

-- ── 5. Le résolveur ──────────────────────────────────────────────────────────
--
-- Rend le chef en fonction à une date donnée. Deux partis pris explicites :
--
--   · `p_date` NULL (document sans date) → le chef COURANT. C'est le seul repli
--     défendable : on ne peut pas dater un acte qu'on ne sait pas dater.
--   · Aucune période ne couvre la date → NULL, et surtout PAS un repli sur
--     `autorites_coutumieres.chef`. Ce repli réintroduirait exactement le défaut
--     corrigé ici. Mieux vaut n'afficher aucun nom qu'en afficher un faux.

create or replace function public.chef_autorite_a_la_date(p_autorite uuid, p_date date)
returns table (nom text, numero_arrete_nomination text, date_arrete date, debut date, fin date)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.nom, c.numero_arrete_nomination, c.date_arrete, c.debut, c.fin
  from chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id = p_autorite
    and (
      case
        when p_date is null then c.fin is null
        else (c.debut is null or p_date >= c.debut)
         and (c.fin   is null or p_date <= c.fin)
      end
    )
  order by c.debut desc nulls last
  limit 1;
$function$;

comment on function public.chef_autorite_a_la_date(uuid, date) is
  'Chef en fonction à p_date. p_date NULL → chef courant. Aucune correspondance → aucune ligne (jamais de repli sur le chef courant : ce serait le défaut d''origine).';

revoke all on function public.chef_autorite_a_la_date(uuid, date) from public;
grant execute on function public.chef_autorite_a_la_date(uuid, date) to authenticated, service_role;
