-- Saisie chefferie en maker-checker : borner d'abord, ouvrir ensuite.
--
-- Demande du 29/07/2026, verbatim :
--   « le dashboard Chefferie devrait avoir la possibilite de saisir des
--     modifications (Lots, Ilots, Attributaires, acquereurs, etc.) qui seront
--     soumises a validation par le Super Admin. Toute saisie ne devra etre
--     possible que si les documents afferants sont renseignes dans la base de
--     donnees. »
--
-- Deux arbitrages tranches par le proprietaire du projet, et NON rouverts ici :
--
--  1. La condition documentaire AVERTIT, elle ne BLOQUE pas. Le maker-checker
--     est deja un point de controle humain, et la condition existante
--     refuserait 898 lots sur 898 (aucune des deux fiches de lotissement n'est
--     complete). L'avertissement nomme les pieces manquantes des DEUX cotes :
--     au moment de soumettre, et dans la file de validation admin. C'est
--     l'approbateur qui tranche, en connaissance de cause. Aucune garde
--     documentaire n'est donc posee dans ce fichier — c'est deliberé, et
--     `manques_documentaires_lotissement` ci-dessous n'existe que pour
--     DIRE, jamais pour refuser.
--
--  2. `maj_attributions` et `creation_structure` restent FERMES a la chefferie.
--     Reattribuer deplace la propriete, et declenche cession puis attestation ;
--     creer une structure fabrique des lots. Ce sont des actes du registre
--     national, pas des corrections de fiche. La symetrie apparente avec les
--     autres types est un piege : ne pas les ouvrir.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 🔴 ORDRE DE TRAVAIL : BORNER AVANT D'OUVRIR
-- ─────────────────────────────────────────────────────────────────────────────
-- Mesure du 30/07/2026, role `authenticated` EMPRUNTE dans une transaction
-- annulee, temoin releve DANS la transaction (auth.uid() =
-- e7091e37-28de-4c9c-ac08-d603a0fae567, mon_groupe() = chefferie,
-- ma_chefferie_id() = a9c32cda-66bb-4f8b-b661-2c0ec0127dcb), avec une SECONDE
-- chefferie FABRIQUEE dans la meme transaction — la production n'en compte
-- qu'une seule qui porte du foncier, donc AUCUN cloisonnement ne s'y observe
-- naturellement et une regression de perimetre y serait invisible :
--
--     lots vus par la chefferie ............ 898  (le lot du monde B : INVISIBLE)
--     attributaires vus .................... 58   (celui du monde B : VISIBLE)
--     attributions vues .................... 1359 (celle du monde B : VISIBLE)
--
-- Autrement dit `lots` est scopee (`lots_read_scope`), mais `attributaires` et
-- `attributions` sont accordees a `chefferie` A L'ECHELLE NATIONALE, sans le
-- moindre filtre territorial. Ouvrir `maj_attributaire` a ce role sans borner
-- d'abord transformerait un droit de LECTURE national latent en droit
-- d'ECRITURE national exercable — exactement la lecon du 28/07 sur `operateur`
-- (dette #17), ou lecture et ecriture avaient du bouger d'un meme geste.
--
-- On borne donc d'abord (§1), on ouvre ensuite (§4).

-- ═════════════════════════════════════════════════════════════════════════════
-- §1. PERIMETRE DE LA CHEFFERIE
-- ═════════════════════════════════════════════════════════════════════════════

-- Le pendant de `lot_ids_operateur()` / `lot_ids_commissaire()` pour la
-- chefferie. Sa definition n'est PAS inventee : c'est la transcription exacte
-- des deux branches que `lots_read_scope` accorde deja au groupe `chefferie`
-- — la juridiction coutumiere, et la famille dont le compte est membre.
-- Ecrire un perimetre plus etroit ici que celui de `lots` produirait deux
-- verites sur la meme question.
--
-- ⚠️ Fail-closed par construction : `ma_chefferie_id()` vaut NULL pour un
-- compte chefferie non rattache (un sur deux en production). `x = NULL` vaut
-- NULL, donc la ligne est EXCLUE. C'est le bon sens de la garde — l'inverse
-- (`not (x)` sur une colonne nullable) est le piege qui a deja produit un faux
-- vert sur ce projet.
create or replace function public.lot_ids_chefferie()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where lo.autorite_coutumiere_id = public.ma_chefferie_id()
     or (lo.famille_id is not null
         and lo.famille_id = (select p.famille_id from profiles p where p.id = auth.uid()));
$$;

comment on function public.lot_ids_chefferie() is
  'Lots du perimetre de la chefferie appelante (juridiction coutumiere OU famille de rattachement). Transcription des branches chefferie de la policy lots_read_scope.';

-- Meme ACL que `lot_ids_operateur()`, mesuree le 30/07 :
-- postgres=X, authenticated=X, service_role=X. Rien pour `anon` ni `PUBLIC`,
-- sous peine d'ecart au controle horaire `securite-exposition-anon`.
revoke all on function public.lot_ids_chefferie() from public;
revoke all on function public.lot_ids_chefferie() from anon;
grant execute on function public.lot_ids_chefferie() to authenticated, service_role;

-- ── attributaires : la chefferie ne voit plus que les siens ──────────────────
-- `alter policy` et non `drop`/`create` : la policy n'est jamais absente, pas
-- meme le temps d'une transaction. La branche `operateur` sert de modele — elle
-- fait deja exactement ce passage par `attributions`, et fonctionne en
-- production depuis le 28/07.
alter policy attributaires_read_metier on public.attributaires
  using (
    (public.mon_groupe() = any (array[
       'operateur_saisie'::groupe_utilisateur,
       'geometre'::groupe_utilisateur,
       'agent_ia'::groupe_utilisateur]))
    or (public.mon_groupe() = 'operateur'::groupe_utilisateur
        and id in (select a.attributaire_id from attributions a
                   where a.lot_id in (select public.lot_ids_operateur())))
    or (public.mon_groupe() = 'chefferie'::groupe_utilisateur
        and id in (select a.attributaire_id from attributions a
                   where a.lot_id in (select public.lot_ids_chefferie())))
  );

-- ── attributions : idem ─────────────────────────────────────────────────────
alter policy attributions_read on public.attributions
  using (
    public.est_admin()
    or (attributaire_id = public.mon_attributaire_id())
    or (public.mon_groupe() = any (array[
         'operateur_saisie'::groupe_utilisateur,
         'verificateur'::groupe_utilisateur]))
    or (public.mon_groupe() = 'chefferie'::groupe_utilisateur
        and lot_id in (select public.lot_ids_chefferie()))
    or (public.mon_groupe() = 'operateur'::groupe_utilisateur
        and lot_id in (select public.lot_ids_operateur()))
    or (public.mon_groupe() = 'commissaire'::groupe_utilisateur
        and lot_id in (select public.lot_ids_commissaire()))
    or (public.mon_groupe() = any (array[
         'proprietaire_terrien'::groupe_utilisateur,
         'acquereur'::groupe_utilisateur])
        and lot_id in (select public.mes_lot_ids()))
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- §2. LA CONDITION DOCUMENTAIRE, COTE LOTISSEMENT
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Rien a concevoir : la regle existe deja et vit dans
-- `manques_documentaires_lot(uuid, integer)`, qui delegue a
-- `calculer_score_confiance`. Les QUATRE pieces qu'elle nomme (APFC, guide de
-- repartition, PV du guide, PV d'identification physique) sont TOUTES portees
-- par le lotissement, aucune par le lot : evaluer un lot quelconque du
-- lotissement rend donc le meme verdict que les evaluer tous.
--
-- 🔴 DEUX MINES, toutes deux relevees en production avant d'ecrire ceci :
--
--  (a) SURCHARGE AMBIGUE. `manques_documentaires_lot` existe en `(uuid)` ET en
--      `(uuid, integer default 1)`. Un appel a UN seul argument echoue en
--      42725 `function is not unique`. Le niveau est donc TOUJOURS passe
--      explicitement, ici comme dans `useAttestations.ts`.
--
--  (b) LE NULL QUI NE REFUSE RIEN. Un lotissement sans aucun lot ferait rendre
--      NULL a la sous-requete. Cote ecran, un tableau nul se lit « aucune piece
--      ne manque » — un faux vert qui ressemble trait pour trait a un succes.
--      Le `coalesce` ci-dessous rend a la place un manque EXPLICITE et non
--      vide. Un tableau vide, lui, veut bien dire « dossier complet », et il ne
--      peut venir que d'une evaluation reellement faite.
create or replace function public.manques_documentaires_lotissement(
  p_lotissement_id uuid,
  p_niveau integer default 2
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.manques_documentaires_lot(l.id, p_niveau)
     from lots l
     join ilots i on i.id = l.ilot_id
     where i.lotissement_id = p_lotissement_id
     order by l.numero_lot nulls last, l.id
     limit 1),
    array['dossier non evaluable : aucun lot rattache a ce lotissement']
  );
$$;

comment on function public.manques_documentaires_lotissement(uuid, integer) is
  'Pieces manquantes du dossier d''un lotissement, evaluees sur un lot representatif (les 4 pieces sont portees par le lotissement). Tableau vide = dossier complet. AVERTIT, ne bloque pas.';

revoke all on function public.manques_documentaires_lotissement(uuid, integer) from public;
revoke all on function public.manques_documentaires_lotissement(uuid, integer) from anon;
grant execute on function public.manques_documentaires_lotissement(uuid, integer)
  to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- §3. LES TYPES DE LA FILE
-- ═════════════════════════════════════════════════════════════════════════════
-- Sans cet elargissement la migration serait inoperante : `soumettre_saisie`
-- accepterait les nouveaux types, mais l'INSERT se ferait rejeter par la
-- contrainte. C'est le troisieme elargissement de cette contrainte (20260716,
-- puis 20260726).
alter table public.soumissions_saisie drop constraint soumissions_saisie_type_check;
alter table public.soumissions_saisie add constraint soumissions_saisie_type_check
  check (type in (
    'maj_attributions','creation_structure','creation_lotissement',
    'modification_lotissement','maj_attributaire',
    'modification_lot','modification_ilot'
  ));

-- ═════════════════════════════════════════════════════════════════════════════
-- §4. LES FONCTIONS D'APPLICATION
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 🔴 CONVENTION UNIQUE, celle de `_appliquer_maj_attributaire` :
--
--        colonne = case when p_payload ? 'cle' then <valeur lue> else colonne end
--
--    Cle ABSENTE  = valeur INCHANGEE.
--    Cle PRESENTE a null = EFFACEMENT volontaire.
--
--    L'autre motif — `colonne = nullif(payload->>'cle','')` sans garde — remet
--    a NULL tout champ absent. Il ne se voit pas a la lecture du code, ne leve
--    aucune erreur, et ne se decouvre qu'apres avoir vide une fiche.

-- ── 4a. modification_lotissement : CORRECTION D'UN EFFACEMENT EN PRODUCTION ──
--
-- 🔴 La version en place remettait 10 colonnes sur 11 a NULL des que la cle
-- etait absente du payload (seul `nom` avait un `coalesce`). Parmi les colonnes
-- effacees : `guide_reference`, `pv_identification_physique_numero` — et, une
-- fois `pv_numero_enregistrement` ajoutee ci-dessous, elle aussi. Ce sont LES
-- PIECES MEMES sur lesquelles s'appuie la condition documentaire du §2 :
-- approuver une correction de commune pouvait donc faire retomber le dossier
-- documentaire du lotissement a zero, en silence.
--
-- L'ecran mobile contourne le defaut en rechargeant la fiche entiere avant de
-- l'envoyer (`LotissementScreen.tsx`, en-tete). Mais cette mitigation vit dans
-- l'ECRAN : tout nouvel appelant — et ce lot en ajoute deux — la reintroduirait.
-- Elle est desormais dans la fonction, ou elle protege tous les appelants.
--
-- ── Et `pv_numero_enregistrement` ──
-- Ni la creation ni la modification n'ecrivaient cette colonne : le « PV du
-- guide de repartition », piece absente des DEUX lotissements du parc, n'avait
-- aucun chemin de saisie. La chefferie aurait lu « PV du guide de repartition
-- manquant » indefiniment sans le moindre moyen de le fournir. Elle est ajoutee
-- au rail `modification_lotissement`.
--   ⚠️ Il n'existe PAS de colonne de date pour ce PV (releve le 30/07 :
--      `lotissements` porte `pv_numero_enregistrement` et
--      `pv_commissaire_justice_id`, pas de `pv_date_enregistrement`). Rien
--      n'est donc invente ici pour la loger.
--   ⚠️ `pv_commissaire_justice_id` reste HORS de ce rail : c'est un
--      rattachement a un commissaire de justice, qui ouvre a ce dernier la
--      lecture du lotissement (`lot_ids_commissaire`). Une chefferie ne
--      distribue pas d'acces.
--   ⚠️ L'APFC (`attestations_coutumieres`) n'est PAS touchee : autre circuit,
--      `est_admin()` seul, hors perimetre.
create or replace function public._appliquer_modification_lotissement(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_payload->>'lotissement_id', '')::uuid;
begin
  if v_id is null then
    raise exception 'lotissement_id manquant dans le payload.';
  end if;
  if not exists (select 1 from lotissements where id = v_id) then
    raise exception 'Lotissement introuvable.';
  end if;

  update lotissements set
    nom = case when p_payload ? 'nom'
               then coalesce(nullif(btrim(p_payload->>'nom'), ''), nom) else nom end,
    village = case when p_payload ? 'village'
               then nullif(btrim(p_payload->>'village'), '') else village end,
    commune = case when p_payload ? 'commune'
               then nullif(btrim(p_payload->>'commune'), '') else commune end,
    district = case when p_payload ? 'district'
               then nullif(btrim(p_payload->>'district'), '') else district end,
    superficie_texte = case when p_payload ? 'superficie_texte'
               then nullif(btrim(p_payload->>'superficie_texte'), '') else superficie_texte end,
    nb_lots = case when p_payload ? 'nb_lots'
               then nullif(p_payload->>'nb_lots', '')::int else nb_lots end,
    nb_ilots = case when p_payload ? 'nb_ilots'
               then nullif(p_payload->>'nb_ilots', '')::int else nb_ilots end,
    guide_reference = case when p_payload ? 'guide_reference'
               then nullif(btrim(p_payload->>'guide_reference'), '') else guide_reference end,
    pv_numero_enregistrement = case when p_payload ? 'pv_numero_enregistrement'
               then nullif(btrim(p_payload->>'pv_numero_enregistrement'), '') else pv_numero_enregistrement end,
    pv_identification_physique_numero = case when p_payload ? 'pv_identification_physique_numero'
               then nullif(btrim(p_payload->>'pv_identification_physique_numero'), '') else pv_identification_physique_numero end,
    pv_identification_physique_date = case when p_payload ? 'pv_identification_physique_date'
               then nullif(p_payload->>'pv_identification_physique_date', '')::date else pv_identification_physique_date end,
    pv_identification_physique_scan_url = case when p_payload ? 'pv_identification_physique_scan_url'
               then nullif(btrim(p_payload->>'pv_identification_physique_scan_url'), '') else pv_identification_physique_scan_url end
  where id = v_id;

  return jsonb_build_object('lotissement_id', v_id);
end;
$$;

comment on function public._appliquer_modification_lotissement(jsonb) is
  'Applique une soumission modification_lotissement. Cle absente = valeur inchangee, cle a null = effacement. Ecrit aussi pv_numero_enregistrement (PV du guide de repartition).';

-- ── 4b. modification_lot ─────────────────────────────────────────────────────
--
-- Ce qui est ECARTE, et pourquoi — la liste des colonnes absentes vaut autant
-- que celle des colonnes presentes :
--
--   `ilot_id`   : deplacer un lot vers un autre ilot le fait potentiellement
--                 changer de LOTISSEMENT, donc de juridiction. C'est une
--                 evasion du perimetre deguisee en correction de fiche.
--   `statut`    : le statut d'un lot suit ses attributions. L'ecrire a la main
--                 court-circuiterait `maj_attributions` — le type meme que la
--                 chefferie n'a pas.
--   `verrouille`: le gel juridique se leve depuis la fiche du lot, par un
--                 administrateur. Un rail de correction ne le manipule pas.
--
-- Et le gel est OPPOSE a la correction : `coalesce(verrouille, false)` — jamais
-- `not verrouille` nu, qui sur une colonne nullable vaudrait NULL et
-- laisserait donc passer.
create or replace function public._appliquer_modification_lot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := nullif(p_payload->>'lot_id', '')::uuid;
  v_gel boolean;
begin
  if v_id is null then
    raise exception 'lot_id manquant dans le payload.';
  end if;
  select coalesce(l.verrouille, false) into v_gel from lots l where l.id = v_id;
  if not found then
    raise exception 'Lot introuvable.';
  end if;
  if v_gel then
    raise exception 'Ce lot est sous gel juridique : sa fiche ne peut pas etre corrigee. Levez le gel d''abord.';
  end if;

  update lots set
    numero_lot = case when p_payload ? 'numero_lot'
               then coalesce(nullif(btrim(p_payload->>'numero_lot'), ''), numero_lot) else numero_lot end,
    numero_parcelle = case when p_payload ? 'numero_parcelle'
               then nullif(btrim(p_payload->>'numero_parcelle'), '') else numero_parcelle end,
    est_equipement = case when p_payload ? 'est_equipement'
               then nullif(p_payload->>'est_equipement', '')::boolean else est_equipement end,
    superficie_m2 = case when p_payload ? 'superficie_m2'
               then nullif(p_payload->>'superficie_m2', '')::numeric else superficie_m2 end,
    nature_droit = case when p_payload ? 'nature_droit'
               then nullif(p_payload->>'nature_droit', '')::nature_droit else nature_droit end,
    observation = case when p_payload ? 'observation'
               then nullif(btrim(p_payload->>'observation'), '') else observation end,
    guide_page = case when p_payload ? 'guide_page'
               then nullif(p_payload->>'guide_page', '')::int else guide_page end,
    latitude = case when p_payload ? 'latitude'
               then nullif(p_payload->>'latitude', '')::numeric else latitude end,
    longitude = case when p_payload ? 'longitude'
               then nullif(p_payload->>'longitude', '')::numeric else longitude end
  where id = v_id;

  return jsonb_build_object('lot_id', v_id);
end;
$$;

comment on function public._appliquer_modification_lot(jsonb) is
  'Applique une soumission modification_lot (fiche descriptive). N''ecrit ni ilot_id, ni statut, ni verrouille. Refuse un lot sous gel juridique.';

-- ── 4c. modification_ilot ────────────────────────────────────────────────────
--
-- Un ilot ne porte que trois colonnes : `id`, `lotissement_id`, `numero`.
-- `lotissement_id` est ECARTE pour la meme raison qu'`ilot_id` ci-dessus :
-- deplacer un ilot d'un lotissement a l'autre emporterait tous ses lots hors
-- de la juridiction qui les a soumis. Reste `numero`, et c'est bien la
-- correction demandee.
create or replace function public._appliquer_modification_ilot(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_payload->>'ilot_id', '')::uuid;
begin
  if v_id is null then
    raise exception 'ilot_id manquant dans le payload.';
  end if;
  if not exists (select 1 from ilots where id = v_id) then
    raise exception 'Ilot introuvable.';
  end if;

  update ilots set
    numero = case when p_payload ? 'numero'
               then coalesce(nullif(btrim(p_payload->>'numero'), ''), numero) else numero end
  where id = v_id;

  return jsonb_build_object('ilot_id', v_id);
end;
$$;

comment on function public._appliquer_modification_ilot(jsonb) is
  'Applique une soumission modification_ilot : le numero de l''ilot. Ne deplace jamais l''ilot vers un autre lotissement.';

-- Les `_appliquer_*` ne s'appellent QUE depuis `approuver_soumission`. Meme ACL
-- que leurs cinq soeurs, mesuree le 30/07 : {postgres, service_role}.
revoke all on function public._appliquer_modification_lot(jsonb) from public, anon, authenticated;
revoke all on function public._appliquer_modification_ilot(jsonb) from public, anon, authenticated;
grant execute on function public._appliquer_modification_lot(jsonb) to service_role;
grant execute on function public._appliquer_modification_ilot(jsonb) to service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- §5. QUI PEUT SOUMETTRE QUOI
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Reprise integrale de la fonction, avec trois changements et rien d'autre :
--
--   (i)   `maj_attributaire` quitte le bloc « saisie nationale » pour un bloc
--         propre, ou la chefferie est admise MAIS BORNEE a son perimetre
--         (§1) et en CORRECTION seulement — elle ne fabrique pas d'identite.
--   (ii)  `modification_lot` et `modification_ilot` rejoignent le bloc
--         chefferie, avec un controle de juridiction remonte depuis le lot ou
--         l'ilot vise, et non depuis le parametre.
--   (iii) 🔴 Le controle de juridiction de `modification_lotissement` portait
--         sur `p_lotissement_id`, alors que `_appliquer_modification_lotissement`
--         ecrit sur `payload->>'lotissement_id'`. Deux valeurs differentes, une
--         seule verifiee : passer sa propre juridiction en parametre et la
--         cible d'autrui dans le payload franchissait la garde. Le controle
--         porte desormais sur la valeur REELLEMENT APPLIQUEE.
--
-- ❌ `maj_attributions` et `creation_structure` restent hors d'atteinte de la
--    chefferie. Voir l'arbitrage 2 en tete de fichier.
create or replace function public.soumettre_saisie(
  p_type text,
  p_lotissement_id uuid,
  p_titre text,
  p_payload jsonb,
  p_resume jsonb default null::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller      uuid := auth.uid();
  v_groupe      text;
  v_id          uuid;
  v_payload     jsonb := p_payload;
  v_lotissement uuid  := p_lotissement_id;
  v_cible       uuid;
begin
  if v_caller is null then
    raise exception 'Authentification requise.';
  end if;
  if p_type not in ('maj_attributions','creation_structure','creation_lotissement',
                    'modification_lotissement','maj_attributaire',
                    'modification_lot','modification_ilot') then
    raise exception 'Type de soumission invalide: %', p_type;
  end if;
  if p_payload is null then
    raise exception 'Payload vide.';
  end if;

  v_groupe := public.mon_groupe()::text;

  -- (1) Registre national : reattribuer, fabriquer une structure.
  if p_type in ('maj_attributions','creation_structure') then
    if not (public.est_admin() or v_groupe = 'operateur_saisie') then
      raise exception 'Action réservée aux opérateurs de saisie.';
    end if;

  -- (2) Identite civile d'un attributaire.
  elsif p_type = 'maj_attributaire' then
    if not (public.est_admin() or v_groupe in ('operateur_saisie','chefferie')) then
      raise exception 'Action réservée aux opérateurs de saisie et aux chefferies.';
    end if;
    if v_groupe = 'chefferie' then
      v_cible := nullif(p_payload->>'attributaire_id', '')::uuid;
      if v_cible is null then
        raise exception 'Une chefferie corrige la fiche d''un attributaire de sa juridiction ; elle n''en crée pas. Transmettez la création au registre national.';
      end if;
      -- Le perimetre du §1, applique a l'ECRITURE. Sans lui, la chefferie
      -- pourrait renommer n'importe quel attributaire du pays — y compris un
      -- attributaire qu'elle ne peut meme pas lire.
      if not exists (
        select 1 from attributions a
        where a.attributaire_id = v_cible
          and a.lot_id in (select public.lot_ids_chefferie())
      ) then
        raise exception 'Cet attributaire ne détient aucun lot de votre juridiction.';
      end if;
    end if;

  -- (3) Fiches du parc : lotissement, ilot, lot.
  else
    if not (public.est_admin() or v_groupe = 'chefferie') then
      raise exception 'Action réservée aux chefferies.';
    end if;

    -- La cible reelle, remontee depuis le payload — jamais depuis le
    -- parametre, qui n'est qu'une indication de l'appelant.
    if p_type = 'modification_lot' then
      select i.lotissement_id into v_cible
      from lots l join ilots i on i.id = l.ilot_id
      where l.id = nullif(p_payload->>'lot_id', '')::uuid;
      if v_cible is null then
        raise exception 'Lot introuvable, ou lot_id manquant dans le payload.';
      end if;
      v_lotissement := v_cible;
    elsif p_type = 'modification_ilot' then
      select i.lotissement_id into v_cible
      from ilots i
      where i.id = nullif(p_payload->>'ilot_id', '')::uuid;
      if v_cible is null then
        raise exception 'Ilot introuvable, ou ilot_id manquant dans le payload.';
      end if;
      v_lotissement := v_cible;
    elsif p_type = 'modification_lotissement' then
      v_lotissement := coalesce(nullif(p_payload->>'lotissement_id', '')::uuid, p_lotissement_id);
    end if;

    if v_groupe = 'chefferie' then
      v_payload := v_payload || jsonb_build_object('autorite_coutumiere_id', public.ma_chefferie_id());
      -- `creation_lotissement` seul echappe au controle : il n'y a pas encore
      -- de lotissement a rattacher, et la juridiction vient d'etre forcee
      -- ci-dessus. Les trois autres visent un objet EXISTANT.
      if p_type <> 'creation_lotissement' and not exists (
        select 1 from lotissements
        where id = v_lotissement
          and autorite_coutumiere_id = public.ma_chefferie_id()
      ) then
        raise exception 'Ce lotissement n''appartient pas à votre juridiction.';
      end if;
    end if;
  end if;

  insert into soumissions_saisie (auteur_id, type, lotissement_id, titre, payload, resume)
  values (v_caller, p_type, v_lotissement, nullif(btrim(p_titre), ''), v_payload, p_resume)
  returning id into v_id;

  return v_id;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- §6. LE DISPATCH A L'APPROBATION
-- ═════════════════════════════════════════════════════════════════════════════
-- Reprise fidele, avec les deux seules branches nouvelles. `est_admin()`,
-- `for update` et le refus d'une soumission deja traitee restent inchanges.
create or replace function public.approuver_soumission(p_id uuid, p_commentaire text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  elsif v_s.type = 'maj_attributaire' then
    v_res := public._appliquer_maj_attributaire(v_s.payload);
  elsif v_s.type = 'modification_lot' then
    v_res := public._appliquer_modification_lot(v_s.payload);
  elsif v_s.type = 'modification_ilot' then
    v_res := public._appliquer_modification_ilot(v_s.payload);
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
$$;
