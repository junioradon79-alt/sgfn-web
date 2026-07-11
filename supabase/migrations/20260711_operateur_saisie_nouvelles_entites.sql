-- Module « Opérateur de saisie » — étape 5b : permettre de créer une nouvelle
-- autorité coutumière / un nouvel opérateur / une nouvelle famille en même
-- temps qu'un nouveau lotissement (au lieu de choisir uniquement parmi
-- l'existant). Même principe que `nouveaux_attributaires` sur maj_attributions :
-- les entités sont créées à l'APPROBATION (jamais à la soumission), et
-- seulement si le payload contient explicitement l'objet correspondant
-- (jamais de création silencieuse).

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
    autorite_coutumiere_id, operateur_id, famille_id, guide_reference, superficie_texte
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

  return jsonb_build_object(
    'lotissement_id', v_lotid,
    'nb_ilots', n_ilots,
    'nb_lots', n_lots,
    'autorite_coutumiere_id', v_autorite_id,
    'operateur_id', v_operateur_id,
    'famille_id', v_famille_id
  );
end;
$function$;

revoke all on function public._appliquer_creation_structure(jsonb) from public;
