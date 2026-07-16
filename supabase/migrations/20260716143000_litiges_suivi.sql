-- Historique + notes de suivi des litiges. Jusqu'ici litiges.statut était une
-- simple colonne mutable sans aucune trace des changements passés ni moyen
-- pour la chefferie d'ajouter un commentaire de suivi (elle est en lecture
-- seule sur le statut lui-même, qui reste réservé à l'équipe SGNF/admin).
--
-- litiges_suivi mélange 2 types d'entrées dans un seul fil chronologique :
--   'statut' : généré automatiquement par trigger à chaque changement de
--              litiges.statut (auteur_id = l'auteur du changement, via auth.uid()).
--   'note'   : ajouté manuellement via ajouter_note_litige() (admin ou chefferie
--              propriétaire du litige) — jamais d'insert direct exposé sur la table.

create table public.litiges_suivi (
  id            uuid primary key default extensions.uuid_generate_v4(),
  litige_id     uuid not null references public.litiges(id) on delete cascade,
  auteur_id     uuid references public.profiles(id),
  type          text not null default 'note' check (type in ('note','statut')),
  statut_avant  text,
  statut_apres  text,
  corps         text,
  cree_le       timestamptz not null default now()
);

create index idx_litiges_suivi_litige_id on public.litiges_suivi(litige_id);

alter table public.litiges_suivi enable row level security;

create policy litiges_suivi_admin_all on public.litiges_suivi for all
  using (est_admin())
  with check (est_admin());

-- Lecture : même périmètre que les 3 policies SELECT de litiges (admin déjà
-- couvert ci-dessus par litiges_suivi_admin_all).
create policy litiges_suivi_read on public.litiges_suivi
for select to authenticated
using (
  exists (
    select 1 from litiges lg
    where lg.id = litiges_suivi.litige_id
    and (
      (mon_groupe() = 'commissaire'::groupe_utilisateur and lg.commissaire_id = mon_commissaire_id())
      or (
        mon_groupe() = 'chefferie'::groupe_utilisateur
        and exists (
          select 1 from lots l
          join ilots i on i.id = l.ilot_id
          join lotissements lo on lo.id = i.lotissement_id
          where l.id = lg.lot_id and lo.autorite_coutumiere_id = ma_chefferie_id()
        )
      )
    )
  )
);

-- Trigger : historise chaque changement de statut, sans toucher au code
-- existant qui fait `update litiges set statut = ...`.
create or replace function public.trg_litiges_historiser_statut()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.statut is distinct from new.statut then
    insert into litiges_suivi (litige_id, auteur_id, type, statut_avant, statut_apres)
    values (new.id, auth.uid(), 'statut', old.statut, new.statut);
  end if;
  return new;
end;
$function$;

create trigger trg_litiges_historiser_statut
  after update of statut on public.litiges
  for each row execute function public.trg_litiges_historiser_statut();

-- RPC : seul point d'écriture pour une note manuelle (admin, ou chefferie sur
-- un litige de sa propre juridiction).
create or replace function public.ajouter_note_litige(p_litige_id uuid, p_corps text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_autorise boolean;
  v_id uuid;
begin
  if nullif(btrim(p_corps), '') is null then
    raise exception 'Note vide.';
  end if;

  select
    est_admin()
    or (
      mon_groupe() = 'chefferie'::groupe_utilisateur
      and exists (
        select 1 from litiges lg
        join lots l on l.id = lg.lot_id
        join ilots i on i.id = l.ilot_id
        join lotissements lo on lo.id = i.lotissement_id
        where lg.id = p_litige_id and lo.autorite_coutumiere_id = ma_chefferie_id()
      )
    )
  into v_autorise;

  if not v_autorise then
    raise exception 'Non autorisé.';
  end if;

  insert into litiges_suivi (litige_id, auteur_id, type, corps)
  values (p_litige_id, auth.uid(), 'note', btrim(p_corps))
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.ajouter_note_litige(uuid, text) from public;
grant execute on function public.ajouter_note_litige(uuid, text) to authenticated;
