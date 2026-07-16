-- Étend le workflow maker-checker de l'opérateur de saisie
-- (20260710_operateur_saisie_module.sql : soumissions_saisie + soumettre_saisie/
-- approuver_soumission/rejeter_soumission) à la chefferie, pour la création et
-- la correction de lotissements sous sa juridiction. Aucune écriture sur
-- lotissements avant approbation admin — même mécanique de file d'attente,
-- réutilisée telle quelle plutôt qu'un second système parallèle. La chefferie
-- ne peut soumettre que ces deux nouveaux types (l'opérateur de saisie garde
-- l'exclusivité des deux types historiques).

alter table public.soumissions_saisie drop constraint soumissions_saisie_type_check;
alter table public.soumissions_saisie add constraint soumissions_saisie_type_check
  check (type in ('maj_attributions','creation_structure','creation_lotissement','modification_lotissement'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Application réelle (SECURITY DEFINER, révoquées — appelées seulement par
-- approuver_soumission). Champs whitelistés = ceux du formulaire
-- LotissementForm.tsx + les 3 colonnes PV d'identification physique.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public._appliquer_creation_lotissement(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if nullif(btrim(p_payload->>'nom'), '') is null then
    raise exception 'Nom du lotissement manquant.';
  end if;

  insert into lotissements (
    nom, village, commune, district, superficie_texte, nb_lots, nb_ilots,
    guide_reference, autorite_coutumiere_id,
    pv_identification_physique_numero, pv_identification_physique_date, pv_identification_physique_scan_url
  )
  values (
    btrim(p_payload->>'nom'),
    nullif(btrim(p_payload->>'village'), ''),
    nullif(btrim(p_payload->>'commune'), ''),
    nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'superficie_texte'), ''),
    nullif(p_payload->>'nb_lots', '')::int,
    nullif(p_payload->>'nb_ilots', '')::int,
    nullif(btrim(p_payload->>'guide_reference'), ''),
    nullif(p_payload->>'autorite_coutumiere_id', '')::uuid,
    nullif(btrim(p_payload->>'pv_identification_physique_numero'), ''),
    nullif(p_payload->>'pv_identification_physique_date', '')::date,
    nullif(btrim(p_payload->>'pv_identification_physique_scan_url'), '')
  )
  returning id into v_id;

  return jsonb_build_object('lotissement_id', v_id);
end;
$function$;

revoke all on function public._appliquer_creation_lotissement(jsonb) from public;

create or replace function public._appliquer_modification_lotissement(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid := (p_payload->>'lotissement_id')::uuid;
begin
  if v_id is null then
    raise exception 'lotissement_id manquant dans le payload.';
  end if;
  if not exists (select 1 from lotissements where id = v_id) then
    raise exception 'Lotissement introuvable.';
  end if;

  update lotissements set
    nom = coalesce(nullif(btrim(p_payload->>'nom'), ''), nom),
    village = nullif(btrim(p_payload->>'village'), ''),
    commune = nullif(btrim(p_payload->>'commune'), ''),
    district = nullif(btrim(p_payload->>'district'), ''),
    superficie_texte = nullif(btrim(p_payload->>'superficie_texte'), ''),
    nb_lots = nullif(p_payload->>'nb_lots', '')::int,
    nb_ilots = nullif(p_payload->>'nb_ilots', '')::int,
    guide_reference = nullif(btrim(p_payload->>'guide_reference'), ''),
    pv_identification_physique_numero = nullif(btrim(p_payload->>'pv_identification_physique_numero'), ''),
    pv_identification_physique_date = nullif(p_payload->>'pv_identification_physique_date', '')::date,
    pv_identification_physique_scan_url = nullif(btrim(p_payload->>'pv_identification_physique_scan_url'), '')
  where id = v_id;

  return jsonb_build_object('lotissement_id', v_id);
end;
$function$;

revoke all on function public._appliquer_modification_lotissement(jsonb) from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- soumettre_saisie() : permission vérifiée par type (les 2 types historiques
-- restent opérateur_saisie/admin, les 2 nouveaux chefferie/admin). Pour un
-- appelant chefferie, l'autorite_coutumiere_id du payload est écrasée
-- serveur-side par ma_chefferie_id() — jamais celle envoyée par le client — et
-- toute modification est vérifiée comme portant sur un lotissement déjà dans
-- sa propre juridiction.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_payload jsonb := p_payload;
begin
  if v_caller is null then
    raise exception 'Authentification requise.';
  end if;
  if p_type not in ('maj_attributions','creation_structure','creation_lotissement','modification_lotissement') then
    raise exception 'Type de soumission invalide: %', p_type;
  end if;
  if p_payload is null then
    raise exception 'Payload vide.';
  end if;

  if p_type in ('maj_attributions','creation_structure') then
    if not (public.est_admin() or public.mon_groupe() = 'operateur_saisie') then
      raise exception 'Action réservée aux opérateurs de saisie.';
    end if;
  else
    if not (public.est_admin() or public.mon_groupe() = 'chefferie') then
      raise exception 'Action réservée aux chefferies.';
    end if;
    if public.mon_groupe() = 'chefferie' then
      v_payload := v_payload || jsonb_build_object('autorite_coutumiere_id', public.ma_chefferie_id());
      if p_type = 'modification_lotissement' and not exists (
        select 1 from lotissements where id = p_lotissement_id and autorite_coutumiere_id = public.ma_chefferie_id()
      ) then
        raise exception 'Ce lotissement n''appartient pas à votre juridiction.';
      end if;
    end if;
  end if;

  insert into soumissions_saisie (auteur_id, type, lotissement_id, titre, payload, resume)
  values (v_caller, p_type, p_lotissement_id, nullif(btrim(p_titre), ''), v_payload, p_resume)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.soumettre_saisie(text, uuid, text, jsonb, jsonb) from public;
grant execute on function public.soumettre_saisie(text, uuid, text, jsonb, jsonb) to authenticated;

-- approuver_soumission() : ajoute les 2 nouvelles branches d'application.
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
  elsif v_s.type = 'creation_lotissement' then
    v_res := public._appliquer_creation_lotissement(v_s.payload);
  elsif v_s.type = 'modification_lotissement' then
    v_res := public._appliquer_modification_lotissement(v_s.payload);
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
