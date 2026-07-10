-- Module « Opérateur de saisie » — étape 1b : table file/journal, RLS, RPC.
-- Workflow maker-checker :
--   1. l'opérateur de saisie (ou admin) SOUMET un payload résolu (soumettre_saisie) → statut 'en_attente'
--      -- AUCUNE écriture sur lots/attributions à ce stade.
--   2. un admin APPROUVE (approuver_soumission) → applique réellement, ou REJETTE (rejeter_soumission).
-- L'application réelle réutilise les garde-fous éprouvés des réconciliations manuelles :
--   historique préservé (actuel=false + rang+1, jamais d'UPDATE en place), pas de génération
--   d'attestation de cession (guard GUC sur le trigger), vérification anti-attestation en fin.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Lecture des attributions pour l'opérateur de saisie (additif, pour construire le diff)
--    Seul trou de lecture : lots/attributaires/ilots/lotissements sont déjà lisibles par tout
--    authentifié ; attributions_read est restreinte par rôle → on ajoute 'operateur_saisie'.
-- ─────────────────────────────────────────────────────────────────────────────
alter policy attributions_read on public.attributions
using (
  est_admin()
  or attributaire_id = mon_attributaire_id()
  or mon_groupe() = any (array[
    'chefferie','operateur','proprietaire','verificateur','commissaire','proprietaire_terrien','operateur_saisie'
  ]::groupe_utilisateur[])
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Garde-fou sur le trigger d'attestation gratuite : GUC transaction-local.
--    Quand sgnf.skip_free_attestation='on', le trigger ne crée aucune attestation.
--    Remplace le « disable trigger » manuel des backfills — pas de DDL/lock, portée transaction.
--    Comportement par défaut inchangé (off = comme avant).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.trg_creer_attestation_gratuite()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('sgnf.skip_free_attestation', true), 'off') = 'on' then
    return new;
  end if;
  if new.qualite in ('ayant_droit', 'operateur') and new.rang = 1 and new.actuel = true then
    perform public.creer_attestation_gratuite_si_eligible(new.lot_id, new.attributaire_id);
  end if;
  return new;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table file d'attente + journal d'audit (un seul objet).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.soumissions_saisie (
  id                uuid primary key default gen_random_uuid(),
  auteur_id         uuid not null references public.profiles(id) on delete cascade,
  type              text not null check (type in ('maj_attributions','creation_structure')),
  lotissement_id    uuid references public.lotissements(id) on delete set null, -- null pour creation_structure
  titre             text,
  payload           jsonb not null,   -- opérations résolues (diff cible)
  resume            jsonb,            -- compteurs pré-calculés côté front (affichage rapide)
  statut            text not null default 'en_attente' check (statut in ('en_attente','approuvee','rejetee')),
  traite_par        uuid references public.profiles(id),
  traite_le         timestamptz,
  commentaire_admin text,
  resultat          jsonb,            -- totaux post-application (rempli à l'approbation)
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);

create index if not exists idx_soumissions_saisie_auteur on public.soumissions_saisie(auteur_id);
create index if not exists idx_soumissions_saisie_statut on public.soumissions_saisie(statut);
create index if not exists idx_soumissions_saisie_lotissement on public.soumissions_saisie(lotissement_id);
create index if not exists idx_soumissions_saisie_traite_par on public.soumissions_saisie(traite_par);

alter table public.soumissions_saisie enable row level security;

-- Lecture : l'auteur voit les siennes, l'admin voit tout. Écritures uniquement via RPC.
drop policy if exists ss_read on public.soumissions_saisie;
create policy ss_read on public.soumissions_saisie
  for select to authenticated
  using (auteur_id = (select auth.uid()) or public.est_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helpers internes d'application (SECURITY DEFINER, révoqués — appelés seulement
--    par approuver_soumission). Pas de garde d'auth ici : l'auth est vérifiée en amont.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._appliquer_maj_attributions(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_lotissement uuid := (p_payload->>'lotissement_id')::uuid;
  v_op    jsonb;
  v_na    jsonb;
  v_lot   uuid;
  v_att   uuid;
  v_qual  qualite_attribution;
  v_ref   text;
  v_cur   record;
  v_rang  int;
  v_new_id uuid;
  v_map   jsonb := '{}'::jsonb;
  v_cnt_before int;
  v_cnt_after  int;
  n_nouvelles int := 0;
  n_reassign  int := 0;
  n_libres    int := 0;
  n_skip      int := 0;
begin
  if v_lotissement is null then
    raise exception 'lotissement_id manquant dans le payload.';
  end if;

  -- Empêche toute génération d'attestation de cession pendant l'application (portée transaction).
  perform set_config('sgnf.skip_free_attestation', 'on', true);

  select count(*) into v_cnt_before
  from attestations_cession ac
  join lots l on l.id = ac.lot_id
  join ilots i on i.id = l.ilot_id
  where i.lotissement_id = v_lotissement;

  -- Créer les nouveaux attributaires explicitement flaggés par l'opérateur → map ref->uuid.
  for v_na in select value from jsonb_array_elements(coalesce(p_payload->'nouveaux_attributaires','[]'::jsonb))
  loop
    insert into attributaires (nom, type, piece_nature, piece_num, telephone, cree_par)
    values (
      btrim(v_na->>'nom'),
      coalesce((v_na->>'type')::type_attributaire, 'personne_physique'),
      nullif(btrim(v_na->>'piece_nature'), ''),
      nullif(btrim(v_na->>'piece_num'), ''),
      nullif(btrim(v_na->>'telephone'), ''),
      auth.uid()
    )
    returning id into v_new_id;
    v_map := v_map || jsonb_build_object(v_na->>'ref', v_new_id::text);
  end loop;

  -- Appliquer chaque opération (pilotée par l'état cible, résiliente à un diff légèrement périmé).
  for v_op in select value from jsonb_array_elements(coalesce(p_payload->'operations','[]'::jsonb))
  loop
    v_lot := (v_op->>'lot_id')::uuid;

    if not exists (
      select 1 from lots l join ilots i on i.id = l.ilot_id
      where l.id = v_lot and i.lotissement_id = v_lotissement
    ) then
      raise exception 'Lot % absent du lotissement déclaré.', v_lot;
    end if;

    if (v_op->>'cible') = 'libre' then
      update attributions set actuel = false where lot_id = v_lot and actuel;
      update lots set statut = 'libre' where id = v_lot;
      n_libres := n_libres + 1;

    elsif (v_op->>'cible') = 'attribue' then
      if nullif(v_op->>'attributaire_id','') is not null then
        v_att := (v_op->>'attributaire_id')::uuid;
      elsif v_op ? 'attributaire_ref' then
        v_ref := v_op->>'attributaire_ref';
        v_att := (v_map->>v_ref)::uuid;
      else
        v_att := null;
      end if;
      if v_att is null then
        raise exception 'Attributaire non résolu pour le lot %.', v_lot;
      end if;
      if not exists (select 1 from attributaires where id = v_att) then
        raise exception 'Attributaire % introuvable.', v_att;
      end if;
      v_qual := (v_op->>'qualite')::qualite_attribution;

      select a.* into v_cur from attributions a where a.lot_id = v_lot and a.actuel limit 1;
      if found and v_cur.attributaire_id = v_att and v_cur.qualite = v_qual then
        n_skip := n_skip + 1;  -- déjà à l'état cible
      else
        if found then
          update attributions set actuel = false where id = v_cur.id;
          n_reassign := n_reassign + 1;
        else
          n_nouvelles := n_nouvelles + 1;
        end if;
        select coalesce(max(rang), 0) + 1 into v_rang from attributions where lot_id = v_lot;
        insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, depuis)
        values (v_lot, v_att, v_qual, v_rang, true, current_date);
        update lots set statut = 'attribue' where id = v_lot;
      end if;
    else
      raise exception 'Cible inconnue: %', v_op->>'cible';
    end if;
  end loop;

  -- Insurance : aucune attestation de cession ne doit avoir été créée.
  select count(*) into v_cnt_after
  from attestations_cession ac
  join lots l on l.id = ac.lot_id
  join ilots i on i.id = l.ilot_id
  where i.lotissement_id = v_lotissement;
  if v_cnt_after <> v_cnt_before then
    raise exception 'Anomalie: % attestation(s) de cession créée(s) pendant la saisie (interdit).',
      v_cnt_after - v_cnt_before;
  end if;

  return jsonb_build_object(
    'nouvelles_attributions', n_nouvelles,
    'reassignations', n_reassign,
    'remises_libre', n_libres,
    'inchanges', n_skip,
    'nouveaux_attributaires', jsonb_array_length(coalesce(p_payload->'nouveaux_attributaires','[]'::jsonb))
  );
end;
$function$;

revoke all on function public._appliquer_maj_attributions(jsonb) from public;

create or replace function public._appliquer_creation_structure(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_meta   jsonb := p_payload->'lotissement';
  v_lotid  uuid;
  v_ilot   jsonb;
  v_ilotid uuid;
  v_l      jsonb;
  n_ilots  int := 0;
  n_lots   int := 0;
  v_equip  boolean;
begin
  if v_meta is null or nullif(btrim(v_meta->>'nom'), '') is null then
    raise exception 'Nom du lotissement manquant.';
  end if;

  insert into lotissements (
    nom, village, commune, district,
    autorite_coutumiere_id, operateur_id, famille_id, guide_reference, superficie_texte
  )
  values (
    btrim(v_meta->>'nom'),
    nullif(btrim(v_meta->>'village'), ''),
    nullif(btrim(v_meta->>'commune'), ''),
    coalesce(nullif(btrim(v_meta->>'district'), ''), 'Abidjan'),
    nullif(v_meta->>'autorite_coutumiere_id', '')::uuid,
    nullif(v_meta->>'operateur_id', '')::uuid,
    nullif(v_meta->>'famille_id', '')::uuid,
    nullif(btrim(v_meta->>'guide_reference'), ''),
    nullif(btrim(v_meta->>'superficie_texte'), '')
  )
  returning id into v_lotid;

  for v_ilot in select value from jsonb_array_elements(coalesce(p_payload->'ilots','[]'::jsonb))
  loop
    insert into ilots (lotissement_id, numero)
    values (v_lotid, btrim(v_ilot->>'numero'))
    returning id into v_ilotid;
    n_ilots := n_ilots + 1;

    for v_l in select value from jsonb_array_elements(coalesce(v_ilot->'lots','[]'::jsonb))
    loop
      v_equip := coalesce((v_l->>'est_equipement')::boolean, false);
      insert into lots (ilot_id, numero_lot, numero_parcelle, superficie_m2, est_equipement, statut, cree_par)
      values (
        v_ilotid,
        btrim(v_l->>'numero_lot'),
        nullif(btrim(v_l->>'numero_parcelle'), ''),
        nullif(v_l->>'superficie_m2', '')::numeric,
        v_equip,
        case when v_equip then 'reserve_equipement'::statut_lot else 'libre'::statut_lot end,
        auth.uid()
      );
      n_lots := n_lots + 1;
    end loop;
  end loop;

  update lotissements set nb_ilots = n_ilots, nb_lots = n_lots where id = v_lotid;

  return jsonb_build_object('lotissement_id', v_lotid, 'nb_ilots', n_ilots, 'nb_lots', n_lots);
end;
$function$;

revoke all on function public._appliquer_creation_structure(jsonb) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC exposées.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. SOUMETTRE — opérateur de saisie (ou admin). Aucune écriture métier ici.
create or replace function public.soumettre_saisie(
  p_type           text,
  p_lotissement_id uuid,
  p_titre          text,
  p_payload        jsonb,
  p_resume         jsonb default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentification requise.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur_saisie') then
    raise exception 'Action réservée aux opérateurs de saisie.';
  end if;
  if p_type not in ('maj_attributions','creation_structure') then
    raise exception 'Type de soumission invalide: %', p_type;
  end if;
  if p_payload is null then
    raise exception 'Payload vide.';
  end if;

  insert into soumissions_saisie (auteur_id, type, lotissement_id, titre, payload, resume)
  values (v_caller, p_type, p_lotissement_id, nullif(btrim(p_titre), ''), p_payload, p_resume)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.soumettre_saisie(text, uuid, text, jsonb, jsonb) from public;
grant execute on function public.soumettre_saisie(text, uuid, text, jsonb, jsonb) to authenticated;

-- 4b. APPROUVER — admin uniquement. Applique réellement puis clôt la soumission.
create or replace function public.approuver_soumission(
  p_id          uuid,
  p_commentaire text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_s   record;
  v_res jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select * into v_s from soumissions_saisie where id = p_id for update;
  if not found then
    raise exception 'Soumission introuvable.';
  end if;
  if v_s.statut <> 'en_attente' then
    raise exception 'Soumission déjà traitée (%).', v_s.statut;
  end if;

  if v_s.type = 'maj_attributions' then
    v_res := public._appliquer_maj_attributions(v_s.payload);
  elsif v_s.type = 'creation_structure' then
    v_res := public._appliquer_creation_structure(v_s.payload);
  else
    raise exception 'Type inconnu: %', v_s.type;
  end if;

  update soumissions_saisie
  set statut = 'approuvee',
      traite_par = auth.uid(),
      traite_le = now(),
      commentaire_admin = nullif(btrim(p_commentaire), ''),
      resultat = v_res,
      maj_le = now()
  where id = p_id;

  return v_res;
end;
$function$;

revoke all on function public.approuver_soumission(uuid, text) from public;
grant execute on function public.approuver_soumission(uuid, text) to authenticated;

-- 4c. REJETER — admin uniquement.
create or replace function public.rejeter_soumission(
  p_id          uuid,
  p_commentaire text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_s record;
begin
  if not public.est_admin() then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select * into v_s from soumissions_saisie where id = p_id for update;
  if not found then
    raise exception 'Soumission introuvable.';
  end if;
  if v_s.statut <> 'en_attente' then
    raise exception 'Soumission déjà traitée (%).', v_s.statut;
  end if;

  update soumissions_saisie
  set statut = 'rejetee',
      traite_par = auth.uid(),
      traite_le = now(),
      commentaire_admin = nullif(btrim(p_commentaire), ''),
      maj_le = now()
  where id = p_id;
end;
$function$;

revoke all on function public.rejeter_soumission(uuid, text) from public;
grant execute on function public.rejeter_soumission(uuid, text) to authenticated;
