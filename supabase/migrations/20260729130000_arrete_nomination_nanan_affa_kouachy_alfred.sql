-- L'arrêté de nomination de NANAN AFFA KOUACHY ALFRED, ancien chef du village
-- d'Ebimpe (autorité a9c32cda-66bb-4f8b-b661-2c0ec0127dcb).
--
-- Fait fourni par le user le 29/07/2026, verbatim :
--   « Voici les références de NANAN AFFA KOUACHY ALFRED:
--     Arrêté de nomination 897/MI/DGAT/DCA/SDCAD du 25/04/2007 »
--
-- Sa ligne d'historique a été créée le 29/07 par `20260729100000` avec
-- `numero_arrete_nomination`, `date_arrete` et `debut` à NULL — faute de source.
-- La pièce existe désormais : on l'inscrit. Sa `fin` (2023-05-11) ne bouge pas,
-- elle reste déduite de l'arrêté 38/PA/SG/D1 du 12/05/2023 qui nomme son
-- successeur.
--
-- ⚠️ Toujours AUCUN COMPTE pour lui (décision du user, cf. 20260729110000) : il
-- n'est plus chef, son nom ne reste attaché qu'à l'APFC-EBIMPE-2022-001 qu'il a
-- signée. Cette migration n'écrit que dans l'historique, jamais dans `profiles`
-- ni dans `autorites_coutumieres.chef` (qui porte le chef COURANT, HOBI MONDON
-- ATSIN PACOME, et ne doit pas bouger).

-- ── Ce que `debut` change vraiment ───────────────────────────────────────────
--
-- La convention du chantier (§4.a de `20260729100000`) est `debut = date_arrete`
-- quand elle est connue. On l'applique — mais elle n'est pas neutre, et la
-- conséquence a été mesurée AVANT d'écrire, pas supposée.
--
-- `debut` NULL est lu par `chef_autorite_a_la_date()` comme une borne ouverte
-- vers le PASSÉ : la période couvrait −infini, et n'importe quelle date
-- antérieure au 11/05/2023 rendait ce nom. En passant `debut` à 2007-04-25, la
-- période se referme et un TROU apparaît sous cette date :
--
--   avant : ]−∞ … 2023-05-11]        → NANAN AFFA KOUACHY ALFRED
--   après : [2007-04-25 … 2023-05-11] → NANAN AFFA KOUACHY ALFRED
--           ]−∞ … 2007-04-24]         → AUCUNE LIGNE, donc « — » à l'écran
--
-- C'est le comportement voulu (§5 de `20260729100000` : « aucun nom plutôt qu'un
-- nom faux ») et c'est même un gain de justesse — il n'a jamais été chef en
-- 1998. Mais il ne devient acceptable qu'à une condition : qu'aucun document
-- existant ne tombe dans le trou.
--
-- ⚠️ RECENSEMENT REFAIT LE 29/07 (migration 20260729140000). La version d'origine
-- de ce commentaire annonçait « 56 dates recensées sur les QUATRE chemins de
-- rattachement ». Ce chiffre n'est reproductible par aucune requête, et le
-- découpage en quatre chemins était faux sur trois points. La CONCLUSION, elle,
-- tient — mais elle tenait pour de mauvaises raisons, ce qui n'est pas la même
-- chose que tenir. Ce qui est faux, nommément :
--
--   · il y a HUIT clés étrangères vers `autorites_coutumieres`, pas quatre :
--     attestations_coutumieres, attributions.enterine_par, lotissements,
--     repartitions_paiement, invitations, profiles, tarifs_attestation_chefferie
--     et chefs_autorites_coutumieres ;
--   · DEUX des quatre chemins déclarés ne rendent AUCUNE ligne, et pas seulement
--     pour Ebimpe : `attributions.enterine_par` est NULL sur les 1 358
--     attributions de la base, et `repartitions_paiement` est une table VIDE.
--     Les compter comme des chemins vérifiés donnait l'illusion d'un
--     recensement large ;
--   · le vrai volume des attributions ne passe pas par `enterine_par` mais par
--     `attributions.lot_id → lots → ilots → lotissements` — 518 lignes datées,
--     invisibles dans la liste d'origine.
--
-- CE QUI EST ÉTABLI, avec la requête ci-dessous (rejouable telle quelle) :
--
--   with lotis as (
--     select id from public.lotissements
--      where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'),
--   lot_ids as (
--     select l.id from public.lots l join public.ilots i on i.id = l.ilot_id
--      where i.lotissement_id in (select id from lotis)),
--   actes(chemin, d) as (
--     select 'A', date_delivrance from public.attestations_coutumieres
--       where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'
--     union all select 'B', enterine_le from public.attributions
--       where enterine_par = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'
--     union all select 'C', cree_le::date from public.repartitions_paiement
--       where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'
--     union all select 'D1', date_leve_topographique        from public.lotissements where id in (select id from lotis)
--     union all select 'D2', pv_identification_physique_date from public.lotissements where id in (select id from lotis)
--     union all select 'D3', cree_le::date                   from public.lotissements where id in (select id from lotis)
--     union all select 'E1', enterine_le  from public.attributions             where lot_id in (select id from lot_ids)
--     union all select 'E2', depuis       from public.attributions             where lot_id in (select id from lot_ids)
--     union all select 'F',  date_emission from public.attestations_cession        where lot_id in (select id from lot_ids)
--     union all select 'G',  date_emission from public.attestations_attribution_lot where lot_id in (select id from lot_ids)
--     union all select 'H',  date_emission from public.certificats_vente           where lot_id in (select id from lot_ids)
--     union all select 'I',  p.date_bornage from public.pv_bornage p
--       join public.missions_geometre m on m.id = p.mission_id
--      where m.lot_id in (select id from lot_ids))
--   select count(*) filter (where d is not null) as datees, min(d) as plus_ancienne,
--          count(*) filter (where d < date '2007-04-25') as avant_le_trou
--     from actes;
--
--   → 2 774 lignes parcourues, dont 573 PORTENT UNE DATE, sur 898 lots et
--     2 lotissements (Koelea-Accor revu, Brignan Kakodji). Réparties ainsi :
--     518 `attributions.depuis`, 51 `attestations_cession.date_emission`,
--     2 `lotissements.cree_le`, 1 `lotissements.date_leve_topographique`,
--     1 `attestations_coutumieres.date_delivrance`. Les chemins B, C, G, H et I
--     ne rendent rien du tout.
--     plus_ancienne = 2022-02-10, avant_le_trou = 0.
--
-- ET LE CONTRÔLE QUI TRANCHE VRAIMENT. Recenser les dates rattachables à
-- l'autorité est prudent mais trop large : la quasi-totalité d'entre elles
-- n'atteint jamais le résolveur. `chef_autorite_a_la_date()` n'a que DEUX
-- appelants dans tout le système, et chacun ne lui passe qu'UNE colonne :
--
--   · public.verifier_document()                         → attestations_coutumieres.date_delivrance
--   · supabase/functions/generation-document/index.ts:208 → attestations_coutumieres.date_delivrance
--   · supabase/functions/generation-document/index.ts:152 → attestations_attribution_lot.date_emission
--     (autorité retrouvée par lot_id → ilots → lotissements)
--
-- Or `attestations_coutumieres` compte UNE seule ligne dans toute la base —
-- APFC-EBIMPE-2022-001, délivrée le 2022-02-10 — et Ebimpe n'a AUCUNE
-- `attestations_attribution_lot`. L'ensemble des dates qui peuvent atteindre le
-- résolveur pour cette chefferie se réduit donc à une seule : 10/02/2022, qui
-- tombe très confortablement dans la période resserrée.
--
-- Le trou créé est vide, sur les deux mesures. À noter pour la suite : si un
-- acte antérieur à 2007 était un jour inscrit pour Ebimpe, il s'afficherait sans
-- signataire — c'est le signal qu'il faudrait documenter un prédécesseur, pas
-- rouvrir `debut`.

-- ── L'écriture ───────────────────────────────────────────────────────────────
--
-- Idempotente par la garde `is null` sur les trois colonnes visées : rejouée,
-- elle ne touche 0 ligne. Cette garde fait double emploi — elle évite aussi
-- d'écraser une correction saisie après coup (l'écran EditerAutoriteModal sait
-- reporter un arrêté sur l'historique, cf. `20260729120000`). Le nom, la `fin`
-- et l'identifiant de l'autorité sont tous les trois dans le `where` : on ne
-- veut toucher QUE cette ligne-là.
--
-- ⚠️ Cet UPDATE réveille `chefs_autorites_sans_chevauchement`, qui s'applique
-- aussi aux UPDATE. Vérifié : la période devient [2007-04-25, 2023-05-12[ et
-- celle du successeur est [2023-05-12, ∞[ — bornes `[)` jointives, donc
-- disjointes. Aucun conflit.
--
-- `autorite_signataire` reste NULL : l'arrêté émane du ministère de l'Intérieur
-- (MI/DGAT/DCA/SDCAD), mais le user n'a pas nommé le signataire et on n'invente
-- pas une source.

update public.chefs_autorites_coutumieres c
set numero_arrete_nomination = '897/MI/DGAT/DCA/SDCAD',
    date_arrete              = date '2007-04-25',
    debut                    = date '2007-04-25'
where c.autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
  and upper(btrim(c.nom)) = 'NANAN AFFA KOUACHY ALFRED'
  and c.fin = date '2023-05-11'
  and c.numero_arrete_nomination is null
  and c.date_arrete is null
  and c.debut is null;

-- ── Garde-fou ────────────────────────────────────────────────────────────────
--
-- Une garde `is null` transforme un échec en silence : si la ligne n'était pas
-- dans l'état attendu, l'UPDATE toucherait 0 ligne et la migration passerait au
-- vert sans avoir rien inscrit. On vérifie donc l'état FINAL plutôt que le
-- nombre de lignes touchées — ce qui reste vrai à la deuxième application.
-- Le contrôle porte sur « le fait est inscrit », pas sur « mes valeurs exactes
-- sont là », pour ne pas casser une correction ultérieure légitime.

do $$
declare
  v_debut date;
  v_arrete text;
  v_date_arrete date;
  v_fin date;
begin
  select debut, numero_arrete_nomination, date_arrete, fin
    into v_debut, v_arrete, v_date_arrete, v_fin
  from public.chefs_autorites_coutumieres
  where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
    and upper(btrim(nom)) = 'NANAN AFFA KOUACHY ALFRED';

  if not found then
    raise exception 'La periode de NANAN AFFA KOUACHY ALFRED est introuvable pour la chefferie d''Ebimpe.';
  end if;
  if v_arrete is null or v_date_arrete is null or v_debut is null then
    raise exception 'Arrete non inscrit : numero=%, date_arrete=%, debut=%.', v_arrete, v_date_arrete, v_debut;
  end if;
  if v_fin is not null and v_debut > v_fin then
    raise exception 'Periode incoherente apres ecriture : debut=% > fin=%.', v_debut, v_fin;
  end if;
end $$;
