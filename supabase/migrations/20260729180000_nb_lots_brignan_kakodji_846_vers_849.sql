-- `lotissements.nb_lots` de Brignan Kakodji : 846 → 849.
--
-- Arbitré par le user le 29/07/2026, sur la démonstration qui suit. Cette
-- migration est le seul endroit où elle est écrite : `public.lotissements` ne
-- porte AUCUN déclencheur d'audit (0 ligne dans `journal_audit` pour cette
-- table, vérifié), donc cette écriture ne laissera aucune trace ailleurs. Qui
-- relira `nb_lots = 849` dans six mois n'aura que cet en-tête pour comprendre
-- pourquoi la valeur a changé — d'où le détail.
--
--
-- ── CE QUE VALAIT 846 ────────────────────────────────────────────────────────
--
-- 846 était le compte de l'IMPORT INITIAL, pas celui du plan de morcellement.
-- La répartition des dates de création des 849 lots du lotissement le montre
-- sans ambiguïté (colonne `lots.cree_le`) :
--
--     28/06/2026 16:34:06  →  846 lots   ← l'import initial, en un seul geste
--     08/07/2026 14:19:08  →    2 lots   ← îlot 01 lot 006, îlot 36 lot 295
--     10/07/2026 10:22:02  →    1 lot    ← îlot 36 lot 285
--
-- 846 est exactement le premier de ces trois nombres. `nb_lots` a été posé au
-- moment de l'import — `_appliquer_creation_structure` fait précisément cela,
-- `update lotissements set nb_ilots = n_ilots, nb_lots = n_lots` — et n'a plus
-- jamais été rafraîchi quand les trois lignes suivantes sont arrivées.
--
--
-- ── CE QUE DIT LE PLAN ───────────────────────────────────────────────────────
--
-- Les quatre versions du guide de répartition présentes dans
-- `OneDrive/Documents/SGFN/03 - Guides de Répartition` ont été dépouillées bloc
-- par bloc (chaque lot y est un bloc « ILOT n LOT n / SUPERFICIE n ») :
--
--   GUIDE KAKODJI.xlsx        (26/06/2026)  849 blocs, 92 îlots
--   GUIDE KAKODJI ACTU.xlsx   (07/07/2026)  849 blocs, 92 îlots
--   GUIDE KAKODJI ACTU1A.xlsx (10/07/2026)  849 blocs, 92 îlots
--   GUIDE KAKODJI ACTU1AB.xlsx(12/07/2026)  849 blocs, 92 îlots
--
-- Les QUATRE disent 849. Décomposition identique de part et d'autre :
--   • 822 blocs portent un numéro de lot   ↔  822 lots `attribue` en base
--   •  27 blocs n'en portent pas           ↔   27 lots `libre`, enregistrés
--                                              en base sous `A-VERIFIER-n`
--
-- Et le point décisif : `GUIDE KAKODJI.xlsx` est daté du **26/06/2026**, soit
-- DEUX JOURS AVANT l'import du 28/06. Or il contient déjà l'îlot 01 lot 006 et
-- l'îlot 36 lot 295 — les deux lignes que l'import n'a pas créées et qui ont dû
-- être rattrapées le 08/07. Ces deux lots n'ont donc pas été AJOUTÉS au plan
-- après coup : ils y étaient depuis l'origine, et c'est l'import qui les a
-- OMIS. (Hypothèse la plus économique, non démontrée : le guide d'origine
-- dédoublait l'îlot 36 lot 295 — deux blocs, 400 m² puis 403 m² — et ce doublon
-- a fait échouer les lignes concernées. `cree_par` est NULL sur les 849 lignes
-- et `journal_audit` ne remonte pas avant l'INSERT : on ne peut pas le prouver.)
--
-- 846 ne correspond donc à aucun document : ni au plan (849), ni à la base
-- (849). C'est le résidu d'un import incomplet.
--
--
-- ── POURQUOI CE N'EST PAS UNE ÉCRITURE DE CONFORT ────────────────────────────
--
-- `nb_lots` sort de la base et atteint le public par trois chemins :
--
--  1. DIRECTEMENT ET EN ANONYME, aujourd'hui. Et par un choix explicite :
--     le rôle `anon` n'a PAS le droit `select` sur la table `lotissements`
--     (son ACL est `anon=awdDxtm/postgres` — pas de `r`), mais il porte un
--     droit `select` COLONNE PAR COLONNE sur exactement huit d'entre elles :
--         id, nom, village, commune, district, superficie_texte,
--         nb_ilots, nb_lots
--     Tout le reste lui est fermé (`superficie_m2`, `guide_reference`,
--     `tf_numero`, `latitude`/`longitude`, les champs de PV…). `nb_lots` fait
--     donc partie des huit champs délibérément ouverts au public anonyme, avec
--     la policy `lotissements_public_read` (`qual = true`) par-dessus.
--     Vérifié en prenant réellement le rôle (`set local role anon`) : la
--     lecture rend bien la ligne. ⚠️ `has_table_privilege('anon', …, 'SELECT')`
--     répond `false` ici et `information_schema.role_table_grants` ne montre
--     aucun `SELECT` pour `anon` : les deux DÉCRIVENT MAL cet accès, parce
--     qu'ils raisonnent au niveau table. Ne pas auditer cette exposition depuis
--     le catalogue — prendre le rôle.
--     C'est aussi ce que consomment les écrans (`LotissementTable`,
--     `LotissementDetailClient`, `/dashboard/carte`, `/dashboard/operateur`,
--     `/dashboard/acquisition`).
--
--  2. Par le QR public — mais PAS ENCORE pour ce lotissement. `verifier_document`
--     ne renvoie `nb_lots` que dans sa branche APFC (`attestations_coutumieres`) ;
--     les branches cession, attribution, certificat de vente et PV de bornage ne
--     l'exposent pas. Or la seule APFC de toute la base, `APFC-EBIMPE-2022-001`,
--     est rattachée à **Koelea-Accor revu**, pas à Brignan Kakodji. La valeur
--     deviendra publique par ce chemin le jour où une APFC sera délivrée pour
--     Brignan Kakodji — pas avant.
--
--  3. Sur le PDF de l'APFC, sous la même condition : `generation-document`
--     injecte `nb_lots` dans le payload PDFMonkey des `attestations_coutumieres`
--     (`supabase/functions/generation-document/index.ts`). Que le gabarit
--     l'imprime effectivement n'a pas pu être vérifié d'ici — le gabarit est
--     hébergé chez PDFMonkey.
--
-- Enfin `conformite_lotissements` affiche `nb_lots` (déclaré) juste à côté de
-- `nb_lots_libres`, lequel est CALCULÉ sur les lots réels : à 846 l'écran de
-- conformité opposait déjà un compte déclaré à un compte dérivé de 849.
--
--
-- ── CE QU'ON NE TOUCHE PAS ───────────────────────────────────────────────────
--
-- `nb_ilots` reste à 92 : c'est JUSTE. 92 îlots en base, 92 îlots dans les
-- quatre versions du guide. Vérifié sur les deux lotissements de la base, aucun
-- écart de `nb_ilots` nulle part.

do $$
declare
  v_avant integer;
  v_apres integer;
  v_reel  integer;
begin
  select nb_lots into v_avant
  from public.lotissements
  where id = '8820c6b8-8ced-468f-bbcc-b63542d79621';

  if v_avant is null then
    raise exception 'Lotissement Brignan Kakodji introuvable : aucune ecriture.';
  end if;

  -- Bornée au seul lotissement, et idempotente par la garde `= 846` :
  -- rejouée, elle ne réécrit rien ; lancée sur une valeur devenue autre
  -- entre-temps, elle n'écrase pas ce que quelqu'un d'autre a posé.
  update public.lotissements
  set nb_lots = 849
  where id = '8820c6b8-8ced-468f-bbcc-b63542d79621'
    and nb_lots = 846;

  -- Assertion sur l'ÉTAT ATTEINT, jamais sur le nombre de lignes touchées :
  -- la garde ci-dessus rend l'`update` silencieux, et un silence ne se
  -- distingue pas d'un échec si on ne relit pas la valeur.
  select nb_lots into v_apres
  from public.lotissements
  where id = '8820c6b8-8ced-468f-bbcc-b63542d79621';

  if v_apres <> 849 then
    raise exception 'nb_lots de Brignan Kakodji vaut % (etait %), 849 attendu.', v_apres, v_avant;
  end if;

  -- Et le corollaire qui donne son sens au nombre : il doit désormais coïncider
  -- avec le compte réel. Si un lot est créé ou supprimé après cette migration,
  -- c'est ICI que le prochain rejeu le signalera.
  select count(*) into v_reel
  from public.lots l
  join public.ilots i on i.id = l.ilot_id
  where i.lotissement_id = '8820c6b8-8ced-468f-bbcc-b63542d79621';

  if v_reel <> v_apres then
    raise exception
      'nb_lots vaut % mais la base contient % lots pour Brignan Kakodji.', v_apres, v_reel;
  end if;
end $$;
