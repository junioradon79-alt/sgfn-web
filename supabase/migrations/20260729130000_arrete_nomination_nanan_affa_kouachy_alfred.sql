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
-- existant ne tombe dans le trou. Recensement fait en production le 29/07 sur
-- les QUATRE chemins de rattachement à cette autorité :
--
--   · attestations_coutumieres.autorite_coutumiere_id (rattachement direct)
--   · attributions.enterine_par (FK vers autorites_coutumieres)
--   · lotissements.autorite_coutumiere_id, et toute la chaîne d'actes sur leurs
--     lots : attestations_cession, attestations_attribution_lot,
--     certificats_vente, pv_bornage (via missions_geometre)
--   · repartitions_paiement.autorite_coutumiere_id
--
--   56 dates recensées, sur 898 lots et 2 lotissements (Koelea-Accor revu,
--   Brignan Kakodji). La PLUS ANCIENNE est 2022-02-10 — la délivrance de
--   l'APFC-EBIMPE-2022-001 elle-même. Aucune date antérieure à 2007-04-25 :
--   `nb_avant_2007_04_25 = 0`.
--
-- Le trou créé est donc vide, et le seul acte concerné (10/02/2022) tombe très
-- confortablement dans la période resserrée. À noter pour la suite : si un acte
-- antérieur à 2007 était un jour inscrit pour Ebimpe, il s'afficherait sans
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
