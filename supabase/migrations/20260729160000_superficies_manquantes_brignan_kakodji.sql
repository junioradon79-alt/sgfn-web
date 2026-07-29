-- Les trois superficies manquantes de Brignan Kakodji, et rien d'autre.
--
-- Sur les 849 lots du lotissement `8820c6b8-8ced-468f-bbcc-b63542d79621`
-- (Brignan Kakodji, village d'Ebimpé, commune d'Anyama), trois — et
-- exactement trois — n'avaient AUCUNE superficie en base. Les trois sont au
-- statut `attribue` : quelqu'un s'est vu attribuer une parcelle dont la
-- surface n'était écrite nulle part dans le registre.
--
-- Le user, le 29/07/2026, verbatim :
--   « Ilot 01 Lot 005: 400 M². Ilot 01 Lot 006: 400 M². Ilot 36 Lot 295: 403 M². »
--
-- Ces trois valeurs ne sont pas des estimations : elles sont EXACTEMENT
-- celles du guide de répartition officiel `GUIDE KAKODJI ACTU1AB.xlsx`, le
-- même document que citent les observations d'attribution du lot 36/285 et du
-- lot 36/295 (« Correction guide ACTU1AB »). Vérifié bloc par bloc :
--   • îlot 01 lot 005 → SUPERFICIE 400  (présent dans TOUTES les versions du
--     guide, y compris la plus ancienne du 26/06/2026)
--   • îlot 01 lot 006 → SUPERFICIE 400
--   • îlot 36 lot 295 → SUPERFICIE 403  (le guide ACTU1AB ne le porte plus
--     qu'UNE fois ; les versions antérieures le dédoublaient à 400 et 403, et
--     c'est ce doublon qui a été corrigé — la ligne survivante est celle à 403,
--     cohérente avec son voisin immédiat, le lot 294, lui aussi à 403 m²)
--
-- Après cette écriture, les 822 lots numérotés de la base portent la superficie
-- du guide ACTU1AB sur 821 d'entre eux, la seule divergence restante étant le
-- lot 68/585 (449 m² en base, ligne SUPERFICIE absente du guide ACTU1AB alors
-- qu'elle valait 449 dans le guide du 26/06) : la base a CONSERVÉ une valeur
-- que la dernière révision du guide a perdue. Ce n'est pas une contradiction,
-- et on n'y touche pas ici.
--
-- ⚠️ CE QUE CETTE MIGRATION NE FAIT PAS, DÉLIBÉRÉMENT
-- `lotissements.nb_lots` vaut 846 pour ce lotissement alors que la base
-- contient 849 lots, et que les quatre versions du guide de répartition en
-- comptent 849 elles aussi (822 numérotés + 27 sans numéro, correspondant aux
-- 27 lots `libre` enregistrés en base sous `A-VERIFIER-n`). `nb_lots` est donc
-- très probablement le compte de l'import initial du 28/06/2026 — 846 lignes
-- créées ce jour-là — et non le compte du plan. Mais `nb_lots` est PUBLIÉ :
-- `verifier_document` le renvoie sur la page publique de vérification par QR.
-- Le corriger est un geste sur ce qui s'affiche au citoyen, pas une écriture
-- de confort : il revient à l'arbitrage du user et n'est pas fait ici.
--
-- ⚠️ PORTÉE RÉELLE DU GESTE : `public.lots` porte le déclencheur
-- `trg_audit_lots` (AFTER INSERT/UPDATE/DELETE FOR EACH ROW → `enregistrer_audit`).
-- Chaque ligne mise à jour écrit donc une ligne dans `journal_audit`, avec
-- l'ancienne et la nouvelle valeur complètes de la ligne. Trois lignes
-- touchées = trois lignes d'audit. Aucun autre déclencheur applicatif n'existe
-- sur `lots` (les autres sont les contraintes d'intégrité référentielle
-- internes de PostgreSQL) : pas de recalcul, pas de propagation. `effectue_par`
-- vaudra NULL, la migration ne s'exécutant sous aucune session authentifiée —
-- c'est déjà le cas des 2716 lignes d'audit existantes sur cette table.

do $$
declare
  v_lotissement constant uuid := '8820c6b8-8ced-468f-bbcc-b63542d79621';
  c            record;
  v_id         uuid;
  v_n          integer;
begin
  for c in
    select *
    from (values ('01', '005', 400::numeric),
                 ('01', '006', 400::numeric),
                 ('36', '295', 403::numeric)) as t(ilot, lot, superficie)
  loop
    -- Les numéros sont du `text` à zéros de tête : on ne cible ni par `int`,
    -- ni par `like`. Et on refuse d'écrire tant qu'on n'a pas la preuve que la
    -- cible désigne UNE ligne — 0 (faute de frappe) comme 2 (homonymie entre
    -- îlots) doivent faire échouer la migration, pas la laisser deviner.
    select count(*), (array_agg(l.id))[1] into v_n, v_id
    from public.lots l
    join public.ilots i on i.id = l.ilot_id
    where i.lotissement_id = v_lotissement
      and i.numero    = c.ilot
      and l.numero_lot = c.lot;

    if v_n <> 1 then
      raise exception
        'Brignan Kakodji, ilot % lot % : % ligne(s) visee(s), 1 attendue. Aucune ecriture.',
        c.ilot, c.lot, v_n;
    end if;

    -- Idempotente par la garde `is null` : rejouée, elle ne réécrit rien.
    update public.lots
    set superficie_m2 = c.superficie
    where id = v_id
      and superficie_m2 is null;
  end loop;
end $$;

-- Assertion finale sur l'ÉTAT ATTEINT, jamais sur le nombre de lignes touchées.
-- La garde `is null` ci-dessus rend l'`update` silencieux quand la valeur est
-- déjà posée — au premier rejeu c'est le comportement voulu, mais si la ligne
-- portait DÉJÀ une autre superficie, le même silence masquerait un échec franc.
-- On vérifie donc ce que la base contient, pas ce que l'`update` a compté.
do $$
declare
  v_ecarts text;
begin
  select string_agg(format('ilot %s lot %s : attendu %s, trouve %s',
                           t.ilot, t.lot, t.superficie,
                           coalesce(l.superficie_m2::text, 'NULL')), ' | ')
  into v_ecarts
  from (values ('01', '005', 400::numeric),
               ('01', '006', 400::numeric),
               ('36', '295', 403::numeric)) as t(ilot, lot, superficie)
  left join public.ilots i
    on i.lotissement_id = '8820c6b8-8ced-468f-bbcc-b63542d79621'
   and i.numero = t.ilot
  left join public.lots l
    on l.ilot_id = i.id
   and l.numero_lot = t.lot
  where l.superficie_m2 is distinct from t.superficie;

  if v_ecarts is not null then
    raise exception 'Superficies Brignan Kakodji non conformes a l''etat attendu : %', v_ecarts;
  end if;
end $$;

-- Et le corollaire : plus AUCUN lot sans superficie sur ce lotissement.
do $$
declare
  v_restants integer;
begin
  select count(*) into v_restants
  from public.lots l
  join public.ilots i on i.id = l.ilot_id
  where i.lotissement_id = '8820c6b8-8ced-468f-bbcc-b63542d79621'
    and l.superficie_m2 is null;

  if v_restants <> 0 then
    raise exception 'Brignan Kakodji : % lot(s) encore sans superficie.', v_restants;
  end if;
end $$;
