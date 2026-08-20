-- Ouvrir `maj_attributions` à la chefferie, en maker-checker, borné à SA
-- juridiction — jamais la famille — et avec le gel juridique refusé dès la
-- SOUMISSION.
--
-- Demande du propriétaire du projet, verbatim : « Impossible de saisir
-- manuellement les changements de propriétaires, cessions, etc. » — puis,
-- après reformulation de la portée : « Oui, rouvrir maj_attributions » — en
-- maker-checker (toujours soumis à validation du Super Admin, aucune
-- application directe).
--
-- ⚠️ `maj_attributions` n'avait JAMAIS été ouvert à la chefferie avant cette
-- migration : il ne s'agit donc pas d'une RÉouverture, malgré le nom du
-- fichier (laissé tel quel — déjà déployé) et le verbe employé par le
-- propriétaire du projet dans sa demande.
--
-- ⚠️ UNE SEULE FONCTION EST TOUCHÉE : `public.soumettre_saisie`.
-- `_appliquer_maj_attributions` (migration 20260727100000) N'EST PAS
-- modifiée : relue ici même par `pg_get_functiondef` avant d'écrire, elle
-- contrôle déjà le gel juridique lot par lot (`v_verrouille is true`) et pose
-- déjà la convention de rang correcte (`coalesce(max(rang),0)+1`). Ouvrir la
-- porte d'ENTRÉE (la soumission) suffit ; la porte d'application était déjà
-- prête à recevoir un appelant chefferie.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- CE QUI CHANGE : LA BRANCHE (1) DU DISPATCH PAR TYPE
-- ═════════════════════════════════════════════════════════════════════════════
-- Avant : `maj_attributions` et `creation_structure` partageaient une seule
-- garde, fermée à quiconque n'est pas admin ou opérateur de saisie.
--
-- Après : les deux types sont séparés. `creation_structure` reste
-- STRICTEMENT identique (admin ou opérateur de saisie, rien de plus — elle
-- fabrique des îlots et des lots, ce n'est pas dans le mandat d'une
-- chefferie). `maj_attributions` s'ouvre à `chefferie`, avec CINQ contrôles
-- supplémentaires, sur le modèle EXACT de ce qui existe déjà pour
-- `modification_lot` / `modification_ilot` / `modification_lotissement` plus
-- bas dans la même fonction :
--
--   1. JURIDICTION SEULE, jamais la famille (doctrine du 30/07,
--      `lot_ids_chefferie()` n'est PAS employée) : le `lotissement_id` du
--      PAYLOAD (la valeur que `_appliquer_maj_attributions` lit réellement,
--      jamais le paramètre `p_lotissement_id`, même doctrine que
--      `modification_lotissement` §4 de la migration 20260730090000) doit
--      appartenir à `ma_chefferie_id()`.
--
--   2. AU MOINS UNE OPÉRATION : arbitrage du propriétaire du projet, posé en
--      cours de chantier — « Une chefferie doit-elle pouvoir créer un nouvel
--      attributaire SANS lui attribuer de lot dans la même soumission ? » →
--      « Non, interdire ». `payload->'operations'` doit être un tableau non
--      vide ; une soumission qui ne ferait que déposer des
--      `nouveaux_attributaires` sans aucune opération est refusée dès la
--      soumission. `operateur_saisie` et `admin` ne sont PAS concernés par
--      cette exigence — rien n'indique que leur usage actuel s'en passe, et
--      l'arbitrage ne visait que la chefferie.
--
--   3. CHAQUE ATTRIBUTAIRE DÉCLARÉ EST RATTACHÉ À UNE OPÉRATION : ferme le
--      contournement du contrôle 2 ci-dessus. Le contrôle 2 exige AU MOINS
--      une opération dans le payload, mais n'exigeait rien sur le contenu de
--      `nouveaux_attributaires` : un payload avec une seule opération anodine
--      (ex. un lot déjà libre remis « libre ») et N fiches dans
--      `nouveaux_attributaires` dont aucune n'est référencée par une
--      opération `cible = 'attribue'` / `attributaire_ref = <ref>` passait
--      quand même la garde ; `_appliquer_maj_attributions` les créerait
--      TOUTES (sa boucle est inconditionnelle), sans qu'aucune ne soit
--      rattachée à un lot — l'acte exact que l'arbitrage « Non, interdire »
--      visait à fermer. Chaque `ref` de `payload->'nouveaux_attributaires'`
--      doit donc être repris par au moins une entrée de
--      `payload->'operations'` via `attributaire_ref`.
--
--   4. CHAQUE LOT APPARTIENT AU LOTISSEMENT DÉCLARÉ : pas seulement à la
--      juridiction de la chefferie (contrôle 1, qui porte sur le
--      `lotissement_id` du payload) ni au gel juridique (contrôle 5
--      ci-dessous), mais explicitement au MÊME lotissement que celui déclaré
--      en tête du payload. Sans ce contrôle, une soumission dont le
--      `lotissement_id` appartient à la chefferie (juridiction A) mais dont
--      un `lot_id` d'`operations` appartient en réalité à un autre
--      lotissement (B, même hors juridiction) passait la garde de soumission
--      et n'était rejetée qu'à l'approbation, par `_appliquer_maj_attributions`
--      — un administrateur découvrant l'incohérence des heures plus tard,
--      sans que la chefferie n'en soit jamais informée.
--
--   5. GEL JURIDIQUE REFUSÉ DÈS LA SOUMISSION : chaque `lot_id` de
--      `payload->'operations'` est vérifié contre `lots.verrouille` — même
--      doctrine que `modification_lot` (§3 de la même migration) : ne pas
--      faire remplir à la chefferie un acte qui sera refusé des heures plus
--      tard, à l'approbation, par un administrateur qui n'y peut rien.
--      `_appliquer_maj_attributions` GARDE son propre contrôle (l'état au
--      moment d'écrire fait foi si le lot a été gelé entre-temps) : les deux
--      ne font pas double emploi.
--
-- Le reste de la fonction (types `maj_attributaire`, fiches du parc) est
-- repris À L'IDENTIQUE de la définition déployée (relue par
-- `pg_get_functiondef` avant d'écrire ce fichier).

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
  v_gel         boolean;
  v_chefferie   uuid;
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

  -- 🔴 UNE CHEFFERIE SANS JURIDICTION NE SAISIT RIEN — quel que soit le type.
  -- Releve en premier, et une seule fois : chaque garde ci-dessous compare a
  -- `ma_chefferie_id()`, et `x = NULL` vaut NULL, donc « aucune ligne » et non
  -- « refus ». Le refus serait donc rendu de toute facon pour trois types sur
  -- quatre, mais avec le message de l'autre defaut (« Ce lotissement
  -- n'appartient pas a votre juridiction »), qui envoie chercher la cause au
  -- mauvais endroit. `creation_lotissement`, lui, ne comparait rien du tout et
  -- passait (defaut preexistant, §2 en tete de la migration 20260730090000).
  if v_groupe = 'chefferie' then
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte de chefferie n''est rattaché à aucune autorité coutumière : aucune saisie dans le registre n''est possible. Demandez ce rattachement à l''administration du SGNF.';
    end if;
  end if;

  -- (1a) Registre national STRICT : fabriquer une structure. Inchangé.
  if p_type = 'creation_structure' then
    if not (public.est_admin() or v_groupe = 'operateur_saisie') then
      raise exception 'Action réservée aux opérateurs de saisie.';
    end if;

  -- (1b) Réattribuer un lot. 🆕 Ouvert à la chefferie, bornée à SA
  -- juridiction et avec le gel juridique refusé dès la soumission.
  elsif p_type = 'maj_attributions' then
    if not (public.est_admin() or v_groupe in ('operateur_saisie','chefferie')) then
      raise exception 'Action réservée aux opérateurs de saisie et aux chefferies.';
    end if;

    if v_groupe = 'chefferie' then
      -- La cible réelle est celle du PAYLOAD — jamais le paramètre, qui n'est
      -- qu'une indication de l'appelant. C'est cette valeur-là que
      -- `_appliquer_maj_attributions` lit (`p_payload->>'lotissement_id'`),
      -- et donc la seule que la garde de juridiction puisse contrôler (même
      -- doctrine que `modification_lotissement`, §4 de la migration
      -- 20260730090000).
      v_lotissement := nullif(p_payload->>'lotissement_id', '')::uuid;
      if v_lotissement is null then
        raise exception 'lotissement_id manquant dans le payload : c''est la seule valeur que l''approbation appliquera, et donc la seule que la garde de juridiction puisse contrôler.';
      end if;

      -- JURIDICTION SEULE. `lot_ids_chefferie()` n'est PAS employée ici :
      -- elle accorde aussi la famille de rattachement, et une chefferie
      -- n'écrit pas au titre d'une appartenance familiale (doctrine du 30/07,
      -- chefferie ≠ chef de famille).
      if not exists (
        select 1 from lotissements
        where id = v_lotissement
          and autorite_coutumiere_id = v_chefferie
      ) then
        raise exception 'Ce lotissement n''appartient pas à votre juridiction.';
      end if;

      -- 🔴 AU MOINS UNE OPÉRATION. Arbitrage du propriétaire du projet :
      -- « Une chefferie doit-elle pouvoir créer un nouvel attributaire SANS
      -- lui attribuer de lot dans la même soumission ? » → « Non, interdire ».
      -- Une soumission qui ne porterait que des `nouveaux_attributaires`,
      -- sans aucune opération pour les rattacher à un lot, n'a pas d'autre
      -- effet que de fabriquer une fiche — c'est l'acte que ce contrôle
      -- ferme. `operateur_saisie` et `admin` ne sont PAS soumis à cette
      -- exigence : l'arbitrage ne visait que la chefferie, et rien n'indique
      -- que leur usage actuel s'en passerait.
      if coalesce(jsonb_array_length(p_payload->'operations'), 0) = 0 then
        raise exception 'Une chefferie doit attribuer au moins un lot ; la création seule d''un attributaire n''est pas ouverte à ce rôle.';
      end if;

      -- 🔴 CHAQUE NOUVEL ATTRIBUTAIRE DÉCLARÉ EST RATTACHÉ À UNE OPÉRATION.
      -- Ferme le contournement de l'arbitrage ci-dessus : le contrôle
      -- précédent n'exige qu'AU MOINS UNE opération dans le payload, pas que
      -- CHAQUE `ref` de `nouveaux_attributaires` soit effectivement repris
      -- par une opération. Sans ce contrôle, un payload avec une seule
      -- opération anodine (ex. un lot déjà libre remis « libre ») et N
      -- fiches dans `nouveaux_attributaires` dont aucune n'est référencée par
      -- une opération `cible = 'attribue'` / `attributaire_ref = <ref>`
      -- passait quand même la garde ; `_appliquer_maj_attributions` les
      -- créerait TOUTES (sa boucle sur `nouveaux_attributaires` est
      -- inconditionnelle), sans qu'aucune ne soit rattachée à un lot — l'acte
      -- exact que l'arbitrage « Non, interdire » ferme. Aggravant : la file
      -- de validation (`FileValidation.tsx`) construit son tableau
      -- Avant/Après uniquement à partir de `operations` — ces fiches
      -- n'y apparaîtraient pas, l'admin approuverait sans les voir.
      if exists (
        select 1
        from jsonb_array_elements(coalesce(p_payload->'nouveaux_attributaires', '[]'::jsonb)) na
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(p_payload->'operations', '[]'::jsonb)) op
          where op->>'attributaire_ref' = na->>'ref'
        )
      ) then
        raise exception 'Chaque nouvel attributaire déclaré doit être attribué à un lot dans la même soumission.';
      end if;

      -- 🔴 CHAQUE LOT APPARTIENT AU LOTISSEMENT DÉCLARÉ, pas seulement à la
      -- juridiction de la chefferie (contrôle ci-dessus, qui ne porte que sur
      -- `v_lotissement` lui-même). Sans ce contrôle, un `lot_id` d'une autre
      -- lotissement passait la garde de soumission et n'était rejeté qu'à
      -- l'approbation, par `_appliquer_maj_attributions` — un administrateur
      -- découvrant l'incohérence des heures plus tard, sans que la chefferie
      -- n'en soit jamais informée.
      if exists (
        select 1
        from jsonb_array_elements(p_payload->'operations') op
        left join lots l      on l.id = nullif(op->>'lot_id', '')::uuid
        left join ilots i     on i.id = l.ilot_id
        where i.lotissement_id is distinct from v_lotissement
      ) then
        raise exception 'Une ou plusieurs opérations portent sur un lot qui n''appartient pas au lotissement déclaré (%).', v_lotissement;
      end if;

      -- GEL JURIDIQUE, refusé DÈS LA SOUMISSION et non à l'approbation — même
      -- doctrine que `modification_lot` (§3 de la migration 20260730090000) :
      -- ne pas faire remplir à la chefferie un acte que l'administrateur
      -- rejettera de toute façon, des heures plus tard, sans pouvoir rien y
      -- faire. `coalesce(l.verrouille, false)` et jamais `not l.verrouille`
      -- nu : sur une colonne nullable, la négation vaudrait NULL et
      -- laisserait donc passer. `_appliquer_maj_attributions` GARDE son
      -- propre contrôle : un lot peut être gelé entre la soumission et
      -- l'approbation, et c'est l'état au moment d'ÉCRIRE qui fait foi. Les
      -- deux ne font pas double emploi.
      if exists (
        select 1
        from jsonb_array_elements(coalesce(p_payload->'operations', '[]'::jsonb)) op
        join lots l on l.id = nullif(op->>'lot_id', '')::uuid
        where coalesce(l.verrouille, false)
      ) then
        raise exception 'Une ou plusieurs opérations portent sur un lot sous gel juridique : la soumission est refusée. Le gel se lève depuis la fiche du lot, par un administrateur.';
      end if;
    end if;

  -- (2) Identite civile d'un attributaire.
  elsif p_type = 'maj_attributaire' then
    if not (public.est_admin() or v_groupe in ('operateur_saisie','chefferie')) then
      raise exception 'Action réservée aux opérateurs de saisie et aux chefferies.';
    end if;
    v_cible := nullif(p_payload->>'attributaire_id', '')::uuid;

    if v_groupe = 'chefferie' then
      if v_cible is null then
        raise exception 'Une chefferie corrige la fiche d''un attributaire de sa juridiction ; elle n''en crée pas. Transmettez la création au registre national.';
      end if;
      -- 🔴 LA JURIDICTION SEULE. `lot_ids_chefferie()` n'est PAS employee ici :
      -- elle accorde aussi la famille de rattachement, et une chefferie
      -- n'ecrit pas au titre d'une appartenance familiale (§1 en tete).
      -- Le meme `select` fait les deux : il BORNE, et il rend le lotissement
      -- auquel rattacher la soumission (§5).
      select i.lotissement_id into v_lotissement
      from attributions a
      join lots l       on l.id = a.lot_id
      join ilots i      on i.id = l.ilot_id
      join lotissements lo on lo.id = i.lotissement_id
      where a.attributaire_id = v_cible
        and lo.autorite_coutumiere_id = v_chefferie
      order by i.lotissement_id
      limit 1;
      if v_lotissement is null then
        raise exception 'Cet attributaire ne détient aucun lot de votre juridiction.';
      end if;
    else
      -- Admin et operateur de saisie : perimetre national, aucune borne a
      -- poser. Le contexte de lotissement est derive quand meme — c'est lui qui
      -- fait apparaitre l'avertissement documentaire dans la file, et un admin
      -- qui valide depuis son telephone n'a rien d'autre pour trancher.
      if v_lotissement is null and v_cible is not null then
        select i.lotissement_id into v_lotissement
        from attributions a
        join lots l  on l.id = a.lot_id
        join ilots i on i.id = l.ilot_id
        where a.attributaire_id = v_cible
        order by i.lotissement_id
        limit 1;
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
      select i.lotissement_id, coalesce(l.verrouille, false)
        into v_cible, v_gel
      from lots l join ilots i on i.id = l.ilot_id
      where l.id = nullif(p_payload->>'lot_id', '')::uuid;
      if v_cible is null then
        raise exception 'Lot introuvable, ou lot_id manquant dans le payload.';
      end if;
      -- Le gel est OPPOSE des la soumission (§3). `coalesce(…, false)` et
      -- jamais `not verrouille` nu : sur une colonne nullable, la negation
      -- vaudrait NULL et laisserait donc passer.
      if v_gel then
        raise exception 'Ce lot est sous gel juridique : sa fiche ne peut pas être corrigée. Le gel se lève depuis la fiche du lot, par un administrateur.';
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
      -- 🔴 AUCUN REPLI sur `p_lotissement_id` (§4) :
      -- `_appliquer_modification_lotissement` n'ecrit QUE d'apres le payload.
      -- Controler le parametre reviendrait a garder une valeur que personne
      -- n'appliquera.
      v_lotissement := nullif(p_payload->>'lotissement_id', '')::uuid;
      if v_lotissement is null then
        raise exception 'lotissement_id manquant dans le payload : c''est la seule valeur que l''approbation appliquera, et donc la seule que la garde de juridiction puisse contrôler.';
      end if;
    end if;

    if v_groupe = 'chefferie' then
      v_payload := v_payload || jsonb_build_object('autorite_coutumiere_id', v_chefferie);
      -- `creation_lotissement` ne vise aucun objet existant : il n'y a pas de
      -- juridiction a comparer, seulement une juridiction a EXIGER — ce que
      -- fait le controle unique en tete de fonction.
      if p_type <> 'creation_lotissement' and not exists (
        select 1 from lotissements
        where id = v_lotissement
          and autorite_coutumiere_id = v_chefferie
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

comment on function public.soumettre_saisie(text, uuid, text, jsonb, jsonb) is
  'Depose une saisie dans la file maker-checker. Chefferie : JURIDICTION seule (jamais la famille), compte non rattache refuse d''emblee, lot sous gel refuse des la soumission (modification_lot ET maj_attributions), modification_lotissement/maj_attributions exigent leur cle de rattachement dans le payload. maj_attributions ouvert a la chefferie le 20/08/2026, avec au moins une operation exigee (une chefferie ne cree pas d''attributaire seul), chaque ref de nouveaux_attributaires rattachee a une operation (attributaire_ref) et chaque lot d''operations verifie contre le lotissement declare (creation_structure reste ferme). Le lotissement de rattachement est toujours derive cote serveur.';
