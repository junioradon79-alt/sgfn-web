-- Saisie chefferie : resserrer sur la JURIDICTION, refuser plus tot, fermer
-- deux gardes que le payload contournait.
--
-- Suite du chantier C1 (migration 20260730080000). Un verificateur tiers a
-- rendu « conforme sur le fond, sans ecart bloquant » et releve cinq ecarts.
-- Ce fichier les corrige, plus un defaut PREEXISTANT trouve en chemin.
--
-- ⚠️ UNE SEULE FONCTION EST TOUCHEE : `public.soumettre_saisie`. Aucune
-- fonction neuve n'est creee — l'event trigger `evt_fonctions_neuves_fermees_a_anon`
-- reste arme et sans effet a produire, et le controle horaire
-- `securite-exposition-anon` reste a 0 ecart par construction.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. 🔴 L'ARBITRAGE : LA JURIDICTION, JAMAIS LA FAMILLE
-- ═════════════════════════════════════════════════════════════════════════════
--
-- `maj_attributaire` etait borne par `lot_ids_chefferie()`, qui accorde la
-- juridiction OU la famille. Les trois autres types etaient bornes par
-- `autorite_coutumiere_id = ma_chefferie_id()`, c'est-a-dire la juridiction
-- SEULE. Deux perimetres pour un meme role, dans une meme fonction.
--
-- Mesure du 30/07/2026, deux identites empruntees chacune dans SA transaction,
-- temoin releve DANS la transaction, sondes sous `set transaction read only`
-- (P0001 = refus de garde, 25006 = garde franchie) :
--
--   compte 0be830c7-…  auth.uid() confirme, mon_groupe()=chefferie,
--                      ma_chefferie_id()=(null), famille 2f980fc3-…
--     maj_attributaire      → 25006  GARDE FRANCHIE
--     modification_lot      → P0001  « Ce lotissement n'appartient pas… »
--     modification_ilot     → P0001  idem
--     modification_lotissement → P0001  idem
--
-- Le meme compte, le meme lotissement (Koelea-Accor), et deux verdicts
-- opposes selon le type. La branche famille de `lot_ids_chefferie()` etait la
-- seule a le laisser passer.
--
-- 🔴 DECISION DU PROPRIETAIRE DU PROJET : RESSERRER SUR LA JURIDICTION.
-- Une chefferie n'agit que sur le territoire dont elle est l'autorite
-- coutumiere, jamais par appartenance familiale. C'est l'application directe
-- de sa directive du 29/07 : **chefferie ≠ chef de famille**, a distinguer
-- nettement.
--
-- ⚠️ CE QUI N'EST PAS FAIT, ET POURQUOI. `lot_ids_chefferie()` n'est PAS
-- resserree. Releve avant de trancher — la fonction a TROIS appelants en
-- production :
--     public.attributaires.attributaires_read_metier   (policy, LECTURE)
--     public.attributions.attributions_read            (policy, LECTURE)
--     public.soumettre_saisie                          (garde d'ECRITURE)
-- Les deux policies sont la transcription deliberee des branches que
-- `lots_read_scope` accorde deja au groupe : le compte 0be830c7-… VOIT les 49
-- lots de Koelea par la branche famille. Resserrer la fonction lui retirerait
-- les attributaires et les attributions de lots qu'il continuerait de voir —
-- deux verites sur la meme question, et une regression de lecture non
-- demandee. C'est donc la GARDE D'ECRITURE qui bouge, et elle seule.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 2. 🔴 DEFAUT PREEXISTANT : `creation_lotissement` ECHAPPAIT A TOUT CONTROLE
-- ═════════════════════════════════════════════════════════════════════════════
-- Mesure : les DEUX comptes chefferie franchissaient (25006), y compris celui
-- dont `ma_chefferie_id()` vaut NULL. Or la fonction force
-- `autorite_coutumiere_id := ma_chefferie_id()` dans le payload : ce compte
-- deposait donc une creation de lotissement rattachee a AUCUNE juridiction,
-- qu'un administrateur aurait approuvee sans rien voir d'anormal. Un
-- lotissement orphelin n'est visible d'aucune chefferie, d'aucun
-- `lot_ids_*()`, et ne se rattrape qu'a la main en base.
--
-- Preexistant au 16/07, hors du perimetre de C1 — mais c'est le meme rail, il
-- etait ouvert, il se ferme ici. La garde nomme la CAUSE (compte non rattache)
-- et non le symptome.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 3. LE GEL JURIDIQUE, REFUSE A LA SOUMISSION ET NON A L'APPROBATION
-- ═════════════════════════════════════════════════════════════════════════════
-- Mesure : `modification_lot` sur ae8063b2-… (`verrouille = true`) franchissait
-- (25006). Seule `_appliquer_modification_lot` refusait — c'est-a-dire que la
-- chefferie remplissait la fiche, soumettait, et c'est l'ADMINISTRATEUR qui
-- recevait l'erreur, plusieurs heures plus tard, sans pouvoir rien en faire.
--
-- Le refus remonte a la soumission. Doctrine deja appliquee au retrait de
-- constat (dette #18) : ne pas faire remplir ce qui sera refuse.
-- ⚠️ Le controle de `_appliquer_modification_lot` RESTE en place : un lot peut
-- etre gele entre la soumission et l'approbation, et c'est l'etat au moment
-- d'ECRIRE qui fait foi. Les deux ne font pas double emploi.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 4. LE PAYLOAD SANS `lotissement_id` — TROU LATENT REFERME
-- ═════════════════════════════════════════════════════════════════════════════
-- Mesure : `modification_lotissement` avec un payload SANS `lotissement_id`
-- franchissait (25006) par repli sur `p_lotissement_id`, puis echouait a
-- l'approbation (`_appliquer_modification_lotissement` ne lit QUE le payload).
-- Les deux appelants d'aujourd'hui envoient bien la cle ; le trou n'etait
-- ouvert que pour un appelant futur — c'est-a-dire pour celui qui ne saura
-- pas. La garde de juridiction doit porter sur la valeur REELLEMENT APPLIQUEE :
-- si le payload ne la nomme pas, il n'y a rien a controler, et le repli
-- controlait une valeur que personne n'ecrirait.
--
-- ═════════════════════════════════════════════════════════════════════════════
-- 5. `maj_attributaire` RETROUVE SON CONTEXTE DE LOTISSEMENT
-- ═════════════════════════════════════════════════════════════════════════════
-- `soumissions_saisie.lotissement_id` restait NULL pour ce type : les deux
-- ecrans envoient `lotissementId: null`, et la fonction n'en derivait aucun.
-- Consequence directe sur l'arbitrage du proprietaire — l'avertissement
-- documentaire, qui ne s'affiche que sur un lotissement connu, ne disait RIEN
-- de ce type dans la file de validation.
--
-- Le lotissement est donc derive COTE SERVEUR, depuis les lots que
-- l'attributaire detient. Jamais depuis le client : une valeur envoyee par
-- l'appelant serait une affirmation, et l'avertissement porterait alors sur un
-- dossier choisi par celui-la meme qui soumet.
-- ⚠️ Un attributaire peut detenir des lots dans plusieurs lotissements. On en
-- retient UN, de facon deterministe (`order by … limit 1`), et pour une
-- chefferie il est necessairement dans SA juridiction. Le champ dit « a quel
-- dossier cette correction se rattache », pas « la liste exhaustive ».

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
  -- passait (defaut preexistant, §2 en tete de fichier).
  if v_groupe = 'chefferie' then
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte de chefferie n''est rattaché à aucune autorité coutumière : aucune saisie dans le registre n''est possible. Demandez ce rattachement à l''administration du SGNF.';
    end if;
  end if;

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
  'Depose une saisie dans la file maker-checker. Chefferie : JURIDICTION seule (jamais la famille), compte non rattache refuse d''emblee, lot sous gel refuse des la soumission, modification_lotissement exige lotissement_id dans le payload. Le lotissement de rattachement est toujours derive cote serveur.';
