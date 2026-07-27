-- Garde de gel juridique sur l'application des attributions.
--
-- Constat (vérificateur indépendant, 27/07/2026) : `lots.verrouille` — le
-- marqueur de gel juridique du système — n'était contrôlé **à aucun étage** du
-- maker-checker. Le dashboard web l'affiche partout (cadenas sur
-- /dashboard/lots et /dashboard/commissaire, « Gel juridique » dans
-- LotDetailModal), mais `_appliquer_maj_attributions` l'ignorait : une
-- soumission portant sur un lot gelé était appliquée sans le moindre signal.
-- Elle closait l'attribution en cours, en créait une nouvelle, et faisait
-- repasser le statut `vendu` en `attribue`.
--
-- 6 lots sur 898 sont dans cet état en production au 27/07/2026.
--
-- 🔴 Pourquoi ici et pas seulement dans l'écran : l'écran mobile refuse déjà
-- l'acte, et le dashboard web affiche désormais le gel sur la ligne à
-- approuver. Mais un garde-fou qui ne vit que dans une interface disparaît avec
-- elle — il faudrait le réécrire à chaque nouveau point de saisie, et l'oubli
-- ne se verrait qu'après coup, sur un dossier foncier réel. La fonction
-- d'application est le seul passage obligé : c'est là que la règle tient.
--
-- ⚠️ Le corps ci-dessous est la définition **déployée** (relue par
-- `pg_get_functiondef` avant écriture), à laquelle s'ajoute le seul bloc
-- `v_verrouille`. Rien d'autre n'est modifié : ni le garde-fou anti-attestation
-- de cession, ni la résolution des nouveaux attributaires, ni les compteurs.

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
  v_verrouille boolean;
  v_numero     text;
  n_nouvelles int := 0;
  n_reassign  int := 0;
  n_libres    int := 0;
  n_skip      int := 0;
begin
  if v_lotissement is null then
    raise exception 'lotissement_id manquant dans le payload.';
  end if;

  perform set_config('sgnf.skip_free_attestation', 'on', true);

  select count(*) into v_cnt_before
  from attestations_cession ac
  join lots l on l.id = ac.lot_id
  join ilots i on i.id = l.ilot_id
  where i.lotissement_id = v_lotissement;

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

  for v_op in select value from jsonb_array_elements(coalesce(p_payload->'operations','[]'::jsonb))
  loop
    v_lot := (v_op->>'lot_id')::uuid;

    -- Appartenance au lotissement déclaré ET gel juridique lus d'un seul coup :
    -- deux requêtes séparées se seraient désynchronisées au premier
    -- réagencement du bloc.
    select l.verrouille, l.numero_lot
      into v_verrouille, v_numero
    from lots l join ilots i on i.id = l.ilot_id
    where l.id = v_lot and i.lotissement_id = v_lotissement;

    if not found then
      raise exception 'Lot % absent du lotissement déclaré.', v_lot;
    end if;

    -- `is true` et non `= true`. La colonne est aujourd'hui `not null default
    -- false`, donc les deux formes sont équivalentes en l'état ; `is true` est
    -- retenu parce qu'il le reste si la contrainte tombait un jour, là où
    -- `null = true` vaut `null` — un `if` qui ne se déclenche pas. Un gel
    -- manquant à cause d'un trois-états serait exactement le défaut d'origine.
    if v_verrouille is true then
      raise exception
        'Lot % sous gel juridique : opération refusée. Le gel doit être levé par un administrateur avant toute réattribution.',
        coalesce(v_numero, v_lot::text);
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
        n_skip := n_skip + 1;
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
