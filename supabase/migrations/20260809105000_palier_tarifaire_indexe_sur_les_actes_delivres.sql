-- =====================================================================
--  TARIF DES ATTESTATIONS — le palier suit les ACTES DÉLIVRÉS, plus le
--  rang d'attribution ; et la première est GRATUITE, pour de bon
--
--  ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────
--  Effet de bord de `20260809110000` (réalignement des rangs), trouvé par
--  le vérificateur APRÈS l'arbitrage sur la gratuité, puis arbitré à son
--  tour par le propriétaire du projet le 09/08/2026 : « corriger le tarif
--  aussi ».
--
--  Le tarif se branchait sur le rang de la prochaine ATTRIBUTION. Or le
--  rang compte les changements de détenteur, et le palier tarifaire doit
--  compter les ACTES DÉLIVRÉS. Les deux coïncidaient tant que chaque
--  transfert produisait une attestation. Ils ont divergé le jour où un
--  import a inscrit des chaînes de détention sans qu'aucun acte ne soit
--  émis : mesuré, ils divergent sur **854 lots sur 871**.
--
--  ── 🔴 ET LES DEUX FONCTIONS SE CONTREDISAIENT DÉJÀ ──────────────────
--  Ce n'est pas ce fichier qui introduit l'incohérence, il la solde. Sur
--  un même lot sans aucun acte délivré, au 09/08 avant toute migration :
--    · `creer_cession` lit `v_actuelle.rang + 1` = 2 → FACTURE 30 000 ;
--    · `facturer_attestation_cession` lit `a.rang` = 1 → REFUSE, « la 1re
--      attestation de ce lot est gratuite (deja generee) ».
--  Deux lectures différentes de la même colonne, deux prix. Et le
--  « (deja generee) » était une DÉDUCTION tirée du rang, fausse sur les
--  822 lots qui n'ont aucun acte parce que leurs pièces manquent.
--
--  ── L'ARBITRAGE, VERBATIM (09/08/2026) ───────────────────────────────
--  Question posée : « Un lot qui n'a JAMAIS reçu d'attestation (822
--  lots) : que doit coûter le tout premier acte de cession ? »
--  Réponse retenue : **« Gratuit — c'est la 1re, donc 0 FCFA »**, lecture
--  littérale de la règle des paliers (1re gratuite, 2e 30 000, 3e et plus
--  tarif chefferie). Conséquence assumée et dite au moment du choix :
--  822 lots perdent le paiement de 30 000 FCFA que `creer_cession`
--  prévoyait aujourd'hui à leur première cession. **C'est une baisse de
--  recette, pas un simple alignement.**
--
--  ── LES MONTANTS EN JEU, RELUS EN BASE LE 09/08 ──────────────────────
--    palier 1 : 0 FCFA
--    palier 2 : 30 000 (20 000 chefferie + 10 000 SGNF), forfait national
--    palier 3+: 380 000 (365 000 chefferie + 15 000 SGNF) — un seul tarif
--               chefferie actif en base à ce jour
--
--  ── RÉPARTITION RÉELLE DES PALIERS, MESURÉE LE 09/08 ─────────────────
--    palier 1 (aucun acte délivré) ............................... 822
--    palier 2 (un acte délivré) ..................................  49
--    palier 3 et plus ............................................   0
--  ⚠️ Ces chiffres EXCLUENT les actes révoqués. Sans cette exclusion on
--  lit « 49 lots au palier 3 », soit 49 lots à 380 000 FCFA qui sont en
--  réalité à 30 000. La révocation ne doit pas consommer de palier :
--  sinon une erreur de l'office renchérit l'acte suivant.
--
--  ── ⚠️ IMPACT IMMÉDIAT : NUL, ET IL FAUT LE DIRE ─────────────────────
--  Mesuré : `lot_peut_emettre_attestation_niveau1()` est faux sur **871
--  lots sur 871** (0 vrai, 0 NULL — ce n'est pas un refus déguisé en
--  zéro). Aucun lot ne peut créer ni facturer une cession aujourd'hui,
--  les deux fonctions refusant en amont sur ce contrôle documentaire.
--  Aucun prix ne change pour personne à cet instant. Ce fichier ne répare
--  pas un préjudice en cours : il empêche une règle fausse d'attendre
--  tranquillement le jour où les pièces arriveront.
--
--  ── ORDRE D'APPLICATION — POURQUOI 105000 ET NON 120000 ──────────────
--  Ce fichier est horodaté AVANT `20260809110000` délibérément. Chaque
--  migration est appliquée dans sa propre transaction. Si le réalignement
--  des rangs passait et que celui-ci échouait, la base resterait avec les
--  rangs réalignés ET le tarif indexé sur le rang : 473 lots à 380 000
--  FCFA en production, sans que personne ne l'ait décidé. Dans cet
--  ordre-ci, la fenêtre n'existe pas. Ses assertions sont vraies dans les
--  deux ordres (vérifié) : le palier ne dépend d'aucun rang.
--
--  ── CE QUI N'EST PAS TOUCHÉ ──────────────────────────────────────────
--  `v_rang` reste `v_actuelle.rang + 1` là où il INSCRIT une attribution :
--  c'est la chaîne de détention, elle n'a rien à voir avec la facturation
--  et elle est juste. Seul le branchement tarifaire change. Les deux
--  notions sont désormais nommées distinctement (`v_rang` / `v_palier`) —
--  leur confusion est l'origine du défaut.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Le palier, calculé au même endroit pour tout le monde
--
--  Il était écrit deux fois, en deux endroits, sous deux formes
--  différentes — et c'est précisément pour cela qu'elles divergeaient.
--  Il n'y en a plus qu'une.
--
--  ── CE QUE « DÉLIVRÉ » VEUT DIRE ─────────────────────────────────────
--  Les DEUX tables d'attestations comptent : `attestations_cession` et
--  `attestations_attribution_lot`. N'en compter qu'une rendrait la 2ᵉ
--  gratuite.
--  ⚠️ Honnêteté sur la preuve : `attestations_attribution_lot` est VIDE
--  en production (0 ligne). Le contrôle du §4 ne peut donc pas détecter
--  son oubli — il rendrait les mêmes chiffres. Cette branche est juste en
--  droit et NON TESTÉE en fait ; le vérificateur l'a relevé, c'est écrit
--  ici plutôt que dissimulé.
--
--  Le filtre est `revoquee_le is null`. ⚠️ Une première rédaction le
--  justifiait par « les deux colonnes `statut` sont des énumérations
--  distinctes » : c'est FAUX, les deux portent le même type
--  `statut_att_cession` (mesuré). La vraie raison est plus simple :
--  `revoquee_le` est une date, son sens ne dépend d'aucune énumération et
--  ne bougera pas si l'on ajoute demain un statut. Les deux critères sont
--  aujourd'hui rigoureusement équivalents (0 divergence sur 106 lignes,
--  dont 57 révoquées).
-- ---------------------------------------------------------------------

create or replace function public.palier_attestation_du_lot(p_lot_id uuid)
returns int
language sql
stable security definer
set search_path to 'public'
as $function$
  select case
    when p_lot_id is null then null
    else 1
       + (select count(*) from attestations_cession c
           where c.lot_id = p_lot_id and c.revoquee_le is null)
       + (select count(*) from attestations_attribution_lot t
           where t.lot_id = p_lot_id and t.revoquee_le is null)
  end::int;
$function$;

comment on function public.palier_attestation_du_lot(uuid) is
  'Rang tarifaire de la PROCHAINE attestation du lot = 1 + le nombre d''actes non révoqués déjà délivrés (attestations_cession + attestations_attribution_lot). 1 = première, GRATUITE ; 2 = forfait national ; 3 et plus = tarif de la chefferie. Rend NULL sur un lot NULL — les appelants doivent le refuser explicitement, un NULL tomberait sinon dans la branche la plus chère. Introduite le 09/08/2026 : le palier se branchait jusque-là sur le rang d''ATTRIBUTION, qui compte les changements de détenteur et non les actes émis — les deux divergent sur 854 lots sur 871.';

-- ── ACL ───────────────────────────────────────────────────────────────
-- `revoke … from public, anon` par discipline, même si le défaut de ce
-- projet ne nomme plus `anon` depuis 20260730010000 (mesuré le 09/08 :
-- pg_default_acl pour postgres/public/f = postgres, authenticated,
-- service_role — plus d'anon). Il reste le défaut PostgreSQL vers PUBLIC.
--
-- 🔴 PAS de `grant … to authenticated`, contrairement aux deux fonctions
-- de la migration 20260809100000. Le vérificateur a relevé qu'il serait
-- non seulement inutile mais nuisible : les deux SEULS appelants sont
-- eux-mêmes SECURITY DEFINER propriété de `postgres`, ils n'ont besoin
-- d'aucun grant. L'accorder à `authenticated` exposerait
-- `POST /rest/v1/rpc/palier_attestation_du_lot` sur n'importe quel
-- `lot_id` — un comptage d'actes lisible par tout compte connecté, y
-- compris par un cédant sur le bien qu'il a cédé, ce que les cinq
-- fermetures du 31/07 ont précisément fermé.
revoke all on function public.palier_attestation_du_lot(uuid) from public, anon;
revoke execute on function public.palier_attestation_du_lot(uuid) from authenticated;


-- ---------------------------------------------------------------------
--  2. `creer_cession` — branchement tarifaire, et le refus du palier 1
--
--  Fonction reproduite À L'IDENTIQUE par ailleurs (garde de rôle,
--  périmètre opérateur, contrôle documentaire, refus si cession en cours,
--  bascule d'attribution, insertion du paiement). Différences avec la
--  version en production :
--   · `v_palier` déclaré, calculé, et REFUSÉ s'il est NULL ;
--   · le palier 1 REFUSE et oriente, au lieu de facturer 30 000 ;
--   · le seuil du forfait national est `v_palier = 2` et non `v_rang = 2` ;
--   · `palier` ajouté au retour, `rang` conservé — les écrans lisent
--     encore `rang`, on ne le leur retire pas.
--
--  ── POURQUOI REFUSER PLUTÔT QUE CRÉER UNE CESSION À 0 FCFA ───────────
--  Parce que la cession gratuite fabriquait un LOT MORT, et ce n'est pas
--  une conjecture : voir le commentaire de la branche elle-même, plus
--  bas, qui détaille la chaîne de triggers mesurée en catalogue.
--  Refuser est aussi la lettre de l'arbitrage : l'option retenue disait
--  « les deux fonctions refuseraient de facturer et renverraient vers la
--  génération gratuite ». Les deux fonctions se comportent donc
--  identiquement au palier 1 — ce qui solde du même coup l'incohérence
--  historique entre elles, qui est le point de départ de ce fichier.
-- ---------------------------------------------------------------------

create or replace function public.creer_cession(
  p_lot_id uuid,
  p_acquereur_id uuid,
  p_date_cession date default current_date,
  p_observation text default null::text,
  p_moyen moyen_paiement default 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lotissement   record;
  v_actuelle      record;
  v_rang          int;
  v_palier        int;
  v_tarif         record;
  v_tarif_chef    record;
  v_montant_total numeric;
  v_commission    numeric;
  v_montant_rev   numeric;
  v_cession_id    uuid;
  v_paiement_id   uuid;
  v_statut_paie   statut_paiement;
  v_beneficiaire  text;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_lot(p_lot_id);

  if p_acquereur_id is null then
    raise exception 'Acquereur requis.';
  end if;

  select lo.id as lotissement_id, lo.operateur_id, lo.autorite_coutumiere_id
    into v_lotissement
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if not found then
    raise exception 'Lot introuvable: %', p_lot_id;
  end if;

  if not public.lot_peut_emettre_attestation_niveau1(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id, 1);
  end if;

  select a.id, a.rang, a.attributaire_id
    into v_actuelle
  from attributions a
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;

  if not found then
    raise exception 'Ce lot n''a pas encore de titulaire actuel : impossible de creer une cession.';
  end if;

  if v_actuelle.attributaire_id = p_acquereur_id then
    raise exception 'L''acquereur selectionne est deja le titulaire actuel du lot.';
  end if;

  if exists (select 1 from cessions c where c.lot_id = p_lot_id and c.statut = 'en_cours') then
    raise exception 'Ce lot fait deja l''objet d''une cession en cours.';
  end if;

  -- Le rang de la nouvelle ATTRIBUTION : chaine de detention, pas tarif.
  v_rang := v_actuelle.rang + 1;

  -- Le palier TARIFAIRE : nombre d'actes non revoques deja delivres + 1.
  v_palier := public.palier_attestation_du_lot(p_lot_id);

  -- Une garde qui vaut NULL ne refuse rien : sans ce test, un palier NULL
  -- tomberait dans le `else` ci-dessous, c'est-a-dire dans la branche a
  -- 380 000 FCFA. Le mode de defaillance le plus cher possible.
  if v_palier is null then
    raise exception 'Palier tarifaire indeterminable pour ce lot : aucune facturation n''est engagee.';
  end if;

  if v_palier <= 1 then
    -- 1er acte du lot : GRATUIT, donc il n'y a rien à vendre ici.
    -- 🔴 UNE PREMIÈRE IMPLÉMENTATION CRÉAIT LA CESSION À 0 FCFA. Le
    -- vérificateur a montré qu'elle FABRIQUAIT UN LOT MORT, et la chaîne
    -- est établie en catalogue : l'insert dans `cessions` déclenche
    -- `trg_verrou_lot` (`verrouiller_lot_vendu`) qui passe le lot en
    -- `vendu` + `verrouille` ; sans ligne de paiement,
    -- `traiter_paiement_confirme` — seul chemin qui écrit une
    -- `attestations_cession` et seul `update cessions` du schéma — ne
    -- tourne jamais ; la cession reste donc `en_cours` à perpétuité, le
    -- lot verrouillé, aucune attestation émise, et `bloquer_double_cession`
    -- interdit toute cession ultérieure. Le rail de la gratuité ne
    -- rattrape rien non plus : `trg_gen_attestation_gratuite` exige
    -- `qualite in ('ayant_droit','operateur') and rang = 1`, or la ligne
    -- créée porte `acquereur` et un rang ≥ 2.
    -- On REFUSE donc, ce qui est aussi la lettre de l'arbitrage rendu le
    -- 09/08 : « les deux fonctions refuseraient de facturer et
    -- renverraient vers la génération gratuite ».
    -- Et le renvoi est un geste RÉEL, pas une formule : la vue
    -- `v_attestations_gratuites_manquantes`, la RPC
    -- `generer_attestations_gratuites_manquantes` et son bouton permanent
    -- sur /dashboard/documents existent et fonctionnent. Une fois l'acte
    -- gratuit délivré, le lot passe au palier 2 et la cession devient
    -- possible au forfait national.
    raise exception 'Aucun acte n''a encore ete delivre pour ce lot : le 1er est GRATUIT et doit etre genere avant toute cession. Ouvrez /dashboard/documents et lancez le rattrapage des attestations gratuites, puis recommencez -- la cession sera alors au forfait national.';
  elsif v_palier = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs
    where type_demarche = 'delivrance_attestation_cession' and actif = true;

    if not found then
      raise exception 'Tarif de la 2e attestation de cession non configure (table tarifs).';
    end if;

    v_montant_total := v_tarif.montant_min;
    v_commission    := v_tarif.commission_min;
  else
    if v_lotissement.autorite_coutumiere_id is null then
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere associee : impossible de calculer le tarif du %e acte.', v_palier;
    end if;

    select montant_chefferie, commission_sgfn into v_tarif_chef
    from tarifs_attestation_chefferie
    where autorite_coutumiere_id = v_lotissement.autorite_coutumiere_id and actif = true;

    if not found then
      raise exception 'Tarif non defini pour cette chefferie (3e attestation et plus) -- contactez l''equipe SGNF pour fixer le tarif.';
    end if;

    v_montant_total := v_tarif_chef.montant_chefferie + v_tarif_chef.commission_sgfn;
    v_commission    := v_tarif_chef.commission_sgfn;
  end if;

  v_montant_rev := v_montant_total - v_commission;

  select nom into v_beneficiaire from attributaires where id = p_acquereur_id;

  insert into cessions (lot_id, acquereur_id, operateur_id, montant_attestation, statut, date_cession, observation)
  values (p_lot_id, p_acquereur_id, v_lotissement.operateur_id, v_montant_total, 'en_cours', coalesce(p_date_cession, current_date), p_observation)
  returning id into v_cession_id;

  update attributions set actuel = false where id = v_actuelle.id;

  insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, operateur_id, depuis, observation)
  values (p_lot_id, p_acquereur_id, 'acquereur', v_rang, true, v_lotissement.operateur_id, coalesce(p_date_cession, current_date), p_observation);

  -- Toujours une ligne de paiement : le palier 1 a ete refuse plus haut,
  -- donc `v_montant_total` est necessairement > 0 ici. Bloc inchange par
  -- rapport a la version en production.
  v_statut_paie := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession_id, p_acquereur_id, 'attestation_cession', v_montant_total, v_commission, v_beneficiaire, p_moyen, v_statut_paie)
  returning id into v_paiement_id;

  return jsonb_build_object(
    'cession_id', v_cession_id,
    'paiement_id', v_paiement_id,
    'rang', v_rang,
    'palier', v_palier,
    'montant_total', v_montant_total,
    'commission_sgfn', v_commission,
    'montant_reverse', v_montant_rev,
    'statut_paiement', v_statut_paie
  );
end;
$function$;


-- ---------------------------------------------------------------------
--  3. `facturer_attestation_cession` — elle FACTURE, donc elle refuse ce
--     qui est gratuit, et elle le dit en lisant le stock réel
--
--  Cette fonction ne crée pas de cession : elle facture un acte pour le
--  titulaire ACTUEL. Au palier 1 il n'y a rien à facturer — l'acte est
--  gratuit —, donc elle refuse et oriente. C'est la même règle que le §2,
--  vue de l'autre côté : ni l'une ni l'autre n'encaisse quoi que ce soit
--  sur un premier acte.
--
--  L'ancien message affirmait « (deja generee) », déduit du rang. Sur les
--  822 lots sans acte, c'était faux : la gratuite n'a pas été générée,
--  elle est bloquée faute de pièces. Le message envoyait l'agent chercher
--  un document qui n'existe pas. Il lit désormais le stock et le dit.
-- ---------------------------------------------------------------------

create or replace function public.facturer_attestation_cession(
  p_lot_id uuid,
  p_moyen moyen_paiement default 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_attr_id uuid; v_nom text; v_rang int; v_palier int; v_op uuid; v_ac uuid;
  v_tarif record; v_tchef record; v_montant numeric; v_commission numeric;
  v_cession uuid; v_paie uuid; v_statut statut_paiement;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_lot(p_lot_id);

  if not public.lot_peut_emettre_attestation_niveau1(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id, 1);
  end if;

  select a.attributaire_id, att.nom, a.rang into v_attr_id, v_nom, v_rang
  from attributions a join attributaires att on att.id = a.attributaire_id
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc limit 1;
  if not found then raise exception 'Ce lot n''a pas de titulaire actuel.'; end if;

  v_palier := public.palier_attestation_du_lot(p_lot_id);

  -- Garde NULL explicite : sans elle, le `else` facturerait 380 000 FCFA.
  if v_palier is null then
    raise exception 'Palier tarifaire indeterminable pour ce lot : aucune facturation n''est engagee.';
  end if;

  if v_palier <= 1 then
    raise exception 'Aucun acte n''a encore ete delivre pour ce lot : le 1er est GRATUIT. Il n''y a rien a facturer -- generez l''attestation, elle ne sera pas payante.';
  end if;

  if exists (
    select 1 from attestations_cession
    where lot_id = p_lot_id and acquereur_id = v_attr_id and statut <> 'revoquee'
  ) then
    raise exception 'Une attestation existe deja pour le titulaire actuel de ce lot.';
  end if;

  select lo.operateur_id, lo.autorite_coutumiere_id into v_op, v_ac
  from lots l join ilots i on i.id = l.ilot_id join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if v_palier = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs where type_demarche = 'delivrance_attestation_cession' and actif = true;
    if not found then raise exception 'Tarif de la 2e attestation de cession non configure (table tarifs).'; end if;
    v_montant := v_tarif.montant_min; v_commission := v_tarif.commission_min;
  else
    if v_ac is null then
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere : tarif du %e acte impossible.', v_palier;
    end if;
    select montant_chefferie, commission_sgfn into v_tchef
    from tarifs_attestation_chefferie where autorite_coutumiere_id = v_ac and actif = true;
    if not found then raise exception 'Tarif non defini pour cette chefferie (3e attestation et plus) -- voir onglet Paiements.'; end if;
    v_montant := v_tchef.montant_chefferie + v_tchef.commission_sgfn; v_commission := v_tchef.commission_sgfn;
  end if;

  insert into cessions (lot_id, acquereur_id, operateur_id, montant_attestation, statut, date_cession, observation)
  values (p_lot_id, v_attr_id, v_op, v_montant, 'en_cours', current_date, 'Attestation de cession (post-vente) -- facturation')
  returning id into v_cession;

  v_statut := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession, v_attr_id, 'attestation_cession', v_montant, v_commission, v_nom, p_moyen, v_statut)
  returning id into v_paie;

  return jsonb_build_object('cession_id', v_cession, 'paiement_id', v_paie,
    'rang', v_rang, 'palier', v_palier,
    'montant_total', v_montant, 'commission_sgfn', v_commission, 'statut_paiement', v_statut);
end;
$function$;


-- ---------------------------------------------------------------------
--  4. Contrôle — la migration échoue si le stock n'est pas celui mesuré
--
--  Les deux fonctions ne peuvent pas être exercées ici : elles refusent
--  toutes deux sur le contrôle documentaire, faux sur 871 lots sur 871.
--  C'est donc le PALIER lui-même qu'on vérifie, sur le stock réel.
--
--  ⚠️ Honnêteté sur la portée : ce contrôle ne départage NI le choix
--  `revoquee_le` vs `statut <> 'revoquee'`, NI l'oubli de la seconde
--  table — les trois écritures rendent les mêmes 822/49/0, la première
--  parce que les deux colonnes concordent, la seconde parce que
--  `attestations_attribution_lot` est vide. Il vaut pour ce qu'il vaut :
--  il détecte un stock qui a bougé, pas une erreur de formule.
--  Preuve qu'il sait échouer : retirer le filtre `revoquee_le` donne
--  v_p2 = 0 au lieu de 49, et l'exception se déclenche.
-- ---------------------------------------------------------------------

do $$
declare
  v_p1 int; v_p2 int; v_p3 int; v_diverge int;
begin
  select count(*) filter (where p = 1),
         count(*) filter (where p = 2),
         count(*) filter (where p >= 3)
    into v_p1, v_p2, v_p3
  from (select public.palier_attestation_du_lot(a.lot_id) p
        from public.attributions a where a.actuel) z;

  select count(*) into v_diverge
  from public.attributions a
  where a.actuel
    and least(public.palier_attestation_du_lot(a.lot_id), 3) <> least(a.rang + 1, 3);

  if v_p1 <> 822 then
    raise exception
      'Palier : % lots sans aucun acte delivre, au lieu des 822 mesures le 09/08. Le stock a bouge : RIEN n''est applique.', v_p1;
  end if;
  if v_p2 <> 49 then
    raise exception
      'Palier : % lots au 2e acte, au lieu des 49 mesures le 09/08. Le stock a bouge : RIEN n''est applique.', v_p2;
  end if;
  if v_p3 <> 0 then
    raise exception
      'Palier : % lots atteignent le 3e acte, alors qu''AUCUN ne le faisait le 09/08 — c''est le palier a 380 000 FCFA. Le stock a bouge : RIEN n''est applique.', v_p3;
  end if;

  -- Témoin de vie, pas preuve : mesuré à 854, et insensible au
  -- réalignement des rangs (854 avant comme après, le clamp à 3 absorbe
  -- le décalage). Ne peut se déclencher que si la nouvelle règle est
  -- devenue identique à l'ancienne — c'est-à-dire si ce fichier ne fait
  -- rien.
  if v_diverge = 0 then
    raise exception
      'Palier : la nouvelle regle ne differe de l''ancienne sur AUCUN lot, alors qu''elle doit differer sur des centaines. Soit le stock a change, soit ce fichier ne fait rien -- dans les deux cas, ne pas livrer en le croyant applique.';
  end if;
end $$;
