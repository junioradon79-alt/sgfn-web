-- ============================================================================
--  type_lotissement dans les 2 RPC de creation par soumission (18/08/2026)
--
--  Suite de 20260818120000_type_lotissement.sql (colonne NOT NULL sans
--  defaut, pas encore appliquee en prod). Le verificateur tiers a trace les 4
--  chemins reels de creation d'un lotissement et releve que SEUL le
--  formulaire admin direct (LotissementForm.tsx, corrige separement cote
--  frontend) fournit `type_lotissement`. Les 3 autres -- chefferie web,
--  operateur web, et leurs equivalents mobile -- passent tous par
--  `soumettre_saisie` -> `approuver_soumission` -> l'une de ces deux
--  fonctions, mesurees en lecture seule le 18/08 (`pg_get_functiondef`,
--  definition EXACTEMENT deployee, reproduite ci-dessous) :
--
--    creation_lotissement -> _appliquer_creation_lotissement(payload)
--    creation_structure   -> _appliquer_creation_structure(payload)
--    (mapping confirme dans approuver_soumission(), migration
--    20260716141500_soumissions_saisie_lotissement.sql)
--
--  Sans ce patch, la migration 20260818120000 (colonne NOT NULL) ferait
--  echouer l'INSERT de ces deux fonctions en '23502 null value in column
--  "type_lotissement" violates not-null constraint' -- au moment de
--  l'approbation, donc APRES que la chefferie/l'operateur ait vu « Proposition
--  envoyee » : l'echec retombe sur l'admin qui approuve, differe dans le
--  temps, sur un dossier que le deposant croit deja acquis.
--
--  Decision du proprietaire (18/08) : coder 'villageois' EN DUR plutot qu'un
--  DEFAULT de colonne ou un gel -- une soumission chefferie/operateur est
--  TOUJOURS, par nature du domaine, un lotissement villageois a l'origine ;
--  le statut approuve/ACD ne peut venir que d'un acte administratif
--  ULTERIEUR, pose ensuite via la RPC admin definir_type_lotissement()
--  (motif obligatoire, trace dans journal_audit).
--
--  Patch minimal : chaque fonction est reprise VERBATIM (definition deployee
--  ci-dessus) avec UNIQUEMENT `type_lotissement` ajoute a la liste de
--  colonnes et `'villageois'` a la liste de valeurs de son
--  `insert into lotissements (...)`. Rien d'autre ne change -- pas de
--  refactor, pas de renommage, pas de nouvelle colonne.
-- ============================================================================

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
    pv_identification_physique_numero, pv_identification_physique_date, pv_identification_physique_scan_url,
    type_lotissement
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
    nullif(btrim(p_payload->>'pv_identification_physique_scan_url'), ''),
    'villageois'
  )
  returning id into v_id;

  return jsonb_build_object('lotissement_id', v_id);
end;
$function$
;

create or replace function public._appliquer_creation_structure(p_payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_meta        jsonb := p_payload->'lotissement';
  v_lotid       uuid;
  v_autorite_id uuid;
  v_operateur_id uuid;
  v_famille_id  uuid;
  v_na          jsonb;
  v_ilot        jsonb;
  v_ilotid      uuid;
  v_l           jsonb;
  n_ilots       int := 0;
  n_lots        int := 0;
  v_equip       boolean;
begin
  if v_meta is null or nullif(btrim(v_meta->>'nom'), '') is null then
    raise exception 'Nom du lotissement manquant.';
  end if;

  -- Autorité coutumière : existante (id fourni) ou nouvelle (créée ici).
  v_autorite_id := nullif(v_meta->>'autorite_coutumiere_id', '')::uuid;
  v_na := p_payload->'nouvelle_autorite';
  if v_na is not null then
    if nullif(btrim(v_na->>'nom'), '') is null then
      raise exception 'Nom de la nouvelle autorité coutumière manquant.';
    end if;
    insert into autorites_coutumieres (nom, type, village, chef, contact)
    values (
      btrim(v_na->>'nom'),
      nullif(btrim(v_na->>'type'), ''),
      nullif(btrim(v_na->>'village'), ''),
      nullif(btrim(v_na->>'chef'), ''),
      nullif(btrim(v_na->>'contact'), '')
    )
    returning id into v_autorite_id;
  end if;

  -- Opérateur : existant (id fourni) ou nouveau (créé ici).
  v_operateur_id := nullif(v_meta->>'operateur_id', '')::uuid;
  v_na := p_payload->'nouvel_operateur';
  if v_na is not null then
    if nullif(btrim(v_na->>'nom'), '') is null then
      raise exception 'Nom du nouvel opérateur manquant.';
    end if;
    insert into operateurs (nom, type, contact)
    values (
      btrim(v_na->>'nom'),
      nullif(btrim(v_na->>'type'), ''),
      nullif(btrim(v_na->>'contact'), '')
    )
    returning id into v_operateur_id;
  end if;

  -- Famille : existante (id fourni) ou nouvelle (créée ici).
  v_famille_id := nullif(v_meta->>'famille_id', '')::uuid;
  v_na := p_payload->'nouvelle_famille';
  if v_na is not null then
    if nullif(btrim(v_na->>'nom'), '') is null then
      raise exception 'Nom de la nouvelle famille manquant.';
    end if;
    insert into familles (nom, chef_de_famille, contact)
    values (
      btrim(v_na->>'nom'),
      nullif(btrim(v_na->>'chef_de_famille'), ''),
      nullif(btrim(v_na->>'contact'), '')
    )
    returning id into v_famille_id;
  end if;

  insert into lotissements (
    nom, village, commune, district,
    autorite_coutumiere_id, operateur_id, famille_id, guide_reference, superficie_texte,
    type_lotissement
  )
  values (
    btrim(v_meta->>'nom'),
    nullif(btrim(v_meta->>'village'), ''),
    nullif(btrim(v_meta->>'commune'), ''),
    coalesce(nullif(btrim(v_meta->>'district'), ''), 'Abidjan'),
    v_autorite_id,
    v_operateur_id,
    v_famille_id,
    nullif(btrim(v_meta->>'guide_reference'), ''),
    nullif(btrim(v_meta->>'superficie_texte'), ''),
    'villageois'
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

  return jsonb_build_object(
    'lotissement_id', v_lotid,
    'nb_ilots', n_ilots,
    'nb_lots', n_lots,
    'autorite_coutumiere_id', v_autorite_id,
    'operateur_id', v_operateur_id,
    'famille_id', v_famille_id
  );
end;
$function$
;
