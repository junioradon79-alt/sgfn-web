-- =====================================================================
--  RANGS D'ATTRIBUTION — une base unique, des chaînes sans doublon, et
--  une contrainte pour que ça le reste
--
--  Trouvé le 09/08/2026 en répondant à une question du propriétaire du
--  projet : « sur le front end je lis 1360 attributions, je voudrais
--  bien comprendre ». Le 1360 était juste (871 actuelles + 489
--  historiques, une seule attribution en cours par lot). Ce sont les
--  RANGS qui ne l'étaient pas.
--
--  ── LES DEUX DÉFAUTS, MESURÉS AVANT ÉCRITURE ─────────────────────────
--   (1) LA BASE EST DOUBLE. 441 chaînes commencent au rang 0, 430 au
--       rang 1 : le même fait — « le détenteur d'origine » — est encodé
--       de deux façons. Tout calcul qui suppose un point de départ fixe
--       se trompe sur l'un des deux groupes.
--   (2) 11 CHAÎNES PORTENT DEUX LIGNES AU MÊME RANG (lots 076 à 085 et
--       159), donc un ordre de succession AMBIGU dans un registre
--       foncier. Forme constatée, identique sur les 11 :
--           rang 0 · depuis NULL       ← le détenteur d'origine
--           rang 0 · depuis 2026-07-10 ← devrait être le rang suivant
--           rang 1 · depuis 2026-07-12 · actuel
--       L'ordre réel n'est pas perdu : `depuis` le donne (NULL = origine,
--       puis les dates croissantes). C'est cette colonne qui tranche
--       ci-dessous, pas une convention inventée.
--
--  ── QUELLE BASE ? LA QUESTION EST DÉJÀ TRANCHÉE PAR LE CODE ──────────
--  `transferer_attribution` et `_appliquer_maj_attributions` portent la
--  même règle, relue en catalogue le 09/08 :
--      select coalesce(max(rang), 0) + 1 into v_rang
--      from attributions where lot_id = …;
--  Sur une chaîne vide, elle donne **1**.
--  ⚠️ Elles ne sont PAS les seules à écrire un rang — une première
--  rédaction l'affirmait, le vérificateur l'a démentie. Il y en a
--  QUATRE : s'ajoutent `creer_cession` (`v_actuelle.rang + 1`) et
--  `ventes_on_soldee` (max des actuels + 1). Aucune ne contredit la base
--  1 ; mais `creer_cession` en TIRE UN TARIF, ce qui est traité plus bas
--  et a été remonté au propriétaire du projet.
--  La base voulue est donc 1, et ce sont
--  les 441 chaînes à rang 0 qui sont l'anomalie : elles viennent d'un
--  import qui a écrit `rang` en dur, sans passer par ces fonctions. Les
--  398 lots à attribution unique portent déjà le rang 1, ils sont la
--  preuve de la convention. Rien n'est inventé ici, on aligne le stock
--  sur la règle que le code applique déjà.
--
--  ── CE QUE CETTE MIGRATION NE TOUCHE PAS ─────────────────────────────
--  `actuel` n'est ni lu comme source, ni réécrit. Il est aujourd'hui
--  RIGOUREUSEMENT cohérent avec `max(rang)` sur les 871 chaînes (mesuré :
--  0 chaîne sans actuel, 0 chaîne à plusieurs actuels, 0 actuel qui ne
--  soit pas le rang max — ce dernier point garanti par l'index unique
--  `attributions_lot_actuel_uniq`). Le renumérotage PRÉSERVE l'ordre
--  relatif, donc l'actuel reste le rang maximum. C'est vérifié par
--  assertion ci-dessous, et la migration échoue si ce n'est pas le cas.
--
--  ── 🔴 CE QUE CETTE MIGRATION CHANGE POUR LA GRATUITÉ — ARBITRÉ ──────
--  DEUX VUES filtrent sur `rang = 1 AND actuel = true` :
--  `v_attestations_gratuites_manquantes` et
--  `v_attestations_bloquees_documents`. Elles pilotent la PREMIÈRE
--  attestation, celle qui est gratuite. Le réalignement déplace donc
--  leur population, et ce n'est pas un effet de bord : c'est le sens de
--  la règle qui se corrige.
--    AVANT : 838 attributions — les 397 lots jamais transférés PLUS les
--            441 lots dont la chaîne partait de 0 et dont le titulaire
--            actuel, numéroté 1, PASSAIT pour le détenteur d'origine
--            alors qu'il a un prédécesseur au rang 0.
--    APRÈS : 397 — les chaînes de longueur 1 PORTANT L'UNE DES DEUX
--            qualités filtrées par les vues (`ayant_droit`, `operateur`).
--            Il y a 398 chaînes de longueur 1 au total ; la 398ᵉ porte une
--            autre qualité. Une première rédaction écrivait « 397 =
--            chaînes de longueur 1 », faux d'une unité — relevé par le
--            vérificateur.
--  Après renumérotage, `rang = 1 AND actuel` devient rigoureusement
--  équivalent à « jamais transféré » : `actuel` est toujours le rang
--  MAXIMUM, et la base est 1 partout, donc rang 1 = max signifie une
--  chaîne à un seul maillon. Les deux vues calculent alors le bon
--  ensemble SANS être redéfinies — et cette migration ne les redéfinit
--  pas, pour ne pas remuer une surface qu'elle n'a pas besoin de
--  toucher. La dépendance est en revanche ASSERTÉE (§5) et écrite sur
--  les vues elles-mêmes (§6) : sans cela, un futur import qui
--  réintroduirait une base 0 les remettrait silencieusement à 838.
--
--  Arbitrage rendu par le propriétaire du projet le 09/08/2026, sur
--  mesure présentée : « 397 — jamais transférés ». Conséquence assumée :
--  441 lots déjà transférés une fois relèvent désormais de l'attestation
--  PAYANTE. Aucune gratuité n'avait encore été émise à ces 441 — les
--  822 lignes de `v_attestations_bloquees_documents` étaient en attente
--  de pièces —, donc rien n'est repris à personne.
--
--  ── 🔴 ET IL Y A UNE SECONDE CONSÉQUENCE, SUR LE TARIF DES CESSIONS ──
--  Trouvée par le vérificateur, APRÈS l'arbitrage — qui ne portait donc
--  que sur la gratuité. Elle est ici parce qu'elle doit être lue par
--  quiconque relira ce fichier.
--  `creer_cession` — la fonction que l'écran appelle — calcule
--  `v_rang := v_actuelle.rang + 1`, puis branche le tarif :
--      si v_rang = 2  → tarif « delivrance_attestation_cession » (2ᵉ)
--      sinon          → tarifs_attestation_chefferie (3ᵉ et plus)
--  Sur les 441 lots réalignés, l'actuel passe du rang 1 au rang 2, donc
--  `v_rang` passe de 2 à 3 : leur prochaine cession bascule du tarif
--  « 2ᵉ attestation » au tarif chefferie. Symétriquement,
--  `facturer_attestation_cession` les refusait (« La 1re attestation de
--  ce lot est gratuite ») et les acceptera.
--  Aucun échec dur à craindre, c'est mesuré : les 441 lots ont tous une
--  autorité coutumière ET un tarif chefferie actif (0 manquant), donc
--  aucune cession ne lèvera « Tarif non défini ». Et le front lit la
--  même règle que la base (`actuel.rang + 1`) : pas de prix affiché
--  différent du prix facturé.
--  C'est cohérent avec l'esprit de l'arbitrage — un 3ᵉ détenteur relève
--  du tarif 3ᵉ — mais c'est un changement de prix, et il a été remonté
--  au propriétaire du projet avant application.
--
--  ── AUTRE EFFET ASSUMÉ : `registre_supervision` ──────────────────────
--  Cette RPC sépare `rang = 1` et `rang > 1`. Après réalignement,
--  `lots_rang_sup_1` passe de 32 à 473, et sur 441 lots la ligne
--  « rang 1 » désigne désormais l'ORIGINE et non plus le titulaire
--  actuel. Sémantiquement une correction ; opérationnellement un
--  changement visible dans le tableau du commissaire et du vérificateur.
--  Mesuré rassurant : la colonne `pv_alerte_statut` ne bouge pas (22
--  avant, 22 après). Même logique dupliquée côté front dans
--  `src/components/dashboard/lots/LotDetailModal.tsx` — même bascule,
--  même conclusion chiffrée.
--
--  ── SIMULATION EN LECTURE SEULE, JOUÉE AVANT D'ÉCRIRE (09/08) ────────
--    lignes totales ........... 1360
--    lignes modifiées .........  893
--    lots touchés .............  441   (les 430 autres sont intacts)
--    doublons après ...........    0
--    trous après ..............    0
--    chaînes en base 1 après ..  871 / 871
--    actuel ≠ rang max après ..    0
--    lot 076 : (0,0,1) → (1,2,3), l'actuel reste le dernier
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Le renumérotage
--
--  ── L'ORDRE, ET POURQUOI IL EST DÉTERMINISTE ─────────────────────────
--  `order by rang, depuis nulls first, id` :
--   · `rang` d'abord — l'ordre déjà enregistré fait foi partout où il
--     n'est pas ambigu, c'est-à-dire sur 860 chaînes sur 871 ;
--   · `depuis nulls first` départage les 11 doublons — une ligne sans
--     date est l'attribution d'origine (aucune des 452 lignes de rang 0
--     issues de l'import n'a de date), une ligne datée lui succède ;
--   · `id` en dernier recours : sans lui, deux lignes de même rang et de
--     même date rendraient le résultat NON DÉTERMINISTE, donc la
--     migration non rejouable à l'identique. Il n'existe aucun tel cas
--     aujourd'hui, la garde est là pour demain.
--
--  ⚠️ La contrainte d'unicité du §2 est posée APRÈS, et ce n'est pas un
--  détail de style : le renumérotage passe par des états transitoires
--  qui la violeraient (mettre la 1re ligne de `0,0,1` à 1 entre en
--  collision avec la 3e, encore à 1). Une contrainte immédiate ferait
--  échouer la migration ; l'ordre inverse est donc IMPOSÉ.
-- ---------------------------------------------------------------------

--  🔴 CE RENUMÉROTAGE RÉVEILLE UN TRIGGER QUI CRÉE DES ATTESTATIONS.
--  `trg_gen_attestation_gratuite` est un AFTER INSERT **OR UPDATE** FOR
--  EACH ROW sur cette table, et son corps est :
--      if new.qualite in ('ayant_droit','operateur')
--         and new.rang = 1 and new.actuel
--      then perform creer_attestation_gratuite_si_eligible(...)
--  Un UPDATE de masse sur `rang` le déclenche donc ligne à ligne.
--  Mesuré : 0 déclenchement en l'état — sur les 441 chaînes base 0, la
--  ligne qui atterrit au rang 1 est l'ORIGINE, jamais l'actuelle. MAIS
--  ce résultat tient au `and a.rang is distinct from c.nouveau`
--  ci-dessous : sans lui, les 430 chaînes déjà en base 1 seraient
--  réécrites à l'identique et **397 lignes appelleraient la création
--  d'attestation gratuite**. Ce n'est donc PAS une économie de style,
--  c'est une SÉCURITÉ — ne pas le retirer en croyant simplifier.
--  Ceinture et bretelles : le drapeau ci-dessous, que le trigger honore
--  déjà (c'est ainsi que `_appliquer_maj_attributions` s'en protège).

select set_config('sgnf.skip_free_attestation', 'on', true);

with cible as (
  select a.id,
         row_number() over (partition by a.lot_id
                            order by a.rang, a.depuis nulls first, a.id) as nouveau
  from public.attributions a
)
update public.attributions a
   set rang = c.nouveau
  from cible c
 where c.id = a.id
   and a.rang is distinct from c.nouveau;   -- ⚠️ SÉCURITÉ, voir ci-dessus


-- ---------------------------------------------------------------------
--  2. Les assertions — la migration échoue plutôt que de laisser passer
--
--  Tout est dans la même transaction implicite : un `raise exception`
--  ici annule le §1. On ne se fie pas au fait que l'UPDATE « a l'air »
--  d'avoir marché — c'est exactement le genre de vert qu'on paie cher.
-- ---------------------------------------------------------------------

do $$
declare
  v_doublons int;
  v_trous    int;
  v_base     int;
  v_actuel   int;
  v_lignes   int;
begin
  select count(*) into v_doublons
  from (select lot_id from public.attributions
        group by lot_id having count(*) <> count(distinct rang)) z;

  select count(*) into v_trous
  from (select lot_id from public.attributions
        group by lot_id having max(rang) - min(rang) + 1 <> count(*)) z;

  select count(*) into v_base
  from (select lot_id from public.attributions
        group by lot_id having min(rang) <> 1) z;

  select count(*) into v_actuel
  from public.attributions a
  where a.actuel
    and a.rang <> (select max(b.rang) from public.attributions b where b.lot_id = a.lot_id);

  select count(*) into v_lignes from public.attributions;

  if v_doublons <> 0 then
    raise exception 'Rangs : % chaine(s) portent encore un doublon.', v_doublons;
  end if;
  if v_trous <> 0 then
    raise exception 'Rangs : % chaine(s) presentent un trou.', v_trous;
  end if;
  if v_base <> 0 then
    raise exception 'Rangs : % chaine(s) ne commencent pas au rang 1.', v_base;
  end if;
  if v_actuel <> 0 then
    raise exception
      'Rangs : % attribution(s) actuelle(s) ne sont plus le rang maximum de leur lot — le renumerotage a change la succession, ce qui est INTERDIT.',
      v_actuel;
  end if;
  -- Même raison qu'au §5 : un `raise warning` est INVISIBLE à travers
  -- l'outillage de ce projet. Sur un registre foncier, un stock qui a
  -- bougé entre la simulation et l'application doit arrêter la main, pas
  -- murmurer dans un journal que personne ne lira.
  if v_lignes <> 1360 then
    raise exception
      'Rangs : % lignes en base au lieu des 1360 mesurees le 09/08. Le stock a bouge depuis la simulation : RIEN n''est applique. Rejouer la simulation, puis reconfirmer le nombre ici.',
      v_lignes;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  3. LE VERROU — pour que le défaut ne puisse pas revenir
--
--  Rien n'empêchait le doublon : la table portait un index unique sur
--  `(lot_id) where actuel` — d'où « un seul actuel par lot », qui a bien
--  tenu — mais AUCUNE unicité sur `(lot_id, rang)`. Les 11 chaînes
--  cassées sont passées par ce trou.
--
--  Ce que la contrainte change pour les écritures existantes : rien.
--  `coalesce(max(rang),0)+1` ne peut pas produire de collision tant que
--  deux transferts sur LE MÊME lot ne s'exécutent pas en parallèle —
--  et `transferer_attribution` pose déjà un `for update of l` sur le
--  lot, qui les sérialise. Dans le cas résiduel (deux appels concurrents
--  par un autre chemin), la contrainte fait échouer le second : c'est
--  très exactement le comportement voulu, un refus valant mieux qu'une
--  succession ambiguë dans un registre foncier.
-- ---------------------------------------------------------------------

alter table public.attributions
  add constraint attributions_lot_rang_uniq unique (lot_id, rang);


-- ---------------------------------------------------------------------
--  4. La conséquence sur la gratuité, ASSERTÉE et non supposée
--
--  Le §2 prouve que les rangs sont propres ; il ne prouve pas que la
--  règle métier a bougé comme prévu. C'est pourtant le seul effet de
--  cette migration qui coûte de l'argent. On le mesure donc, et on
--  refuse de livrer si le compte n'est pas celui qui a été arbitré.
-- ---------------------------------------------------------------------

do $$
declare
  v_jamais_transfere int;
  v_predicat_vues    int;
begin
  select count(*) into v_jamais_transfere
  from public.attributions a
  where a.actuel
    and a.qualite in ('ayant_droit','operateur')
    and 1 = (select count(*) from public.attributions b where b.lot_id = a.lot_id);

  select count(*) into v_predicat_vues
  from public.attributions a
  where a.actuel and a.qualite in ('ayant_droit','operateur') and a.rang = 1;

  if v_predicat_vues <> v_jamais_transfere then
    raise exception
      'Gratuite : le predicat des vues (rang=1 et actuel) selectionne % lignes, mais % lots seulement n''ont jamais ete transferes. L''equivalence sur laquelle repose l''arbitrage du 09/08 est ROMPUE.',
      v_predicat_vues, v_jamais_transfere;
  end if;

  -- 🔴 EXCEPTION, ET NON `raise warning`. Mesuré par le vérificateur le
  -- 09/08 : un `raise warning` ou `raise notice` émis par une migration
  -- passée via `scripts/supabase-sql.ps1` N'APPARAÎT NULLE PART dans la
  -- réponse. Succès et alerte sont indiscernables. Un garde-fou invisible
  -- n'est pas un garde-fou — et celui-ci porte le seul effet de cette
  -- migration qui coûte de l'argent. Il doit donc ARRÊTER.
  -- Si le stock a légitimement bougé depuis l'arbitrage, c'est au
  -- propriétaire du projet de reconfirmer le nombre : corriger le 397
  -- ci-dessous et rejouer, en connaissance de cause.
  if v_predicat_vues <> 397 then
    raise exception
      'Gratuite : % lots eligibles a la premiere attestation, au lieu des 397 sur lesquels le proprietaire du projet a arbitre le 09/08. Le stock a bouge : RIEN n''est applique. Relire, puis reconfirmer le nombre dans cette migration.',
      v_predicat_vues;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  5. LA CONVENTION ET SES DÉPENDANCES, ÉCRITES LÀ OÙ ON LES CHERCHERA
--
--  La règle n'était consignée NULLE PART : `col_description` sur `rang`
--  rendait NULL, et elle ne vivait que dans le corps de quatre
--  fonctions. C'est ce silence qui a laissé un import écrire une seconde
--  base sans que rien ne proteste.
--
--  Les deux vues ne sont pas redéfinies — leur SQL devient correct du
--  seul fait que la base est désormais 1. Mais un lecteur qui tomberait
--  sur `rang = 1` sans connaître cette histoire ne pourrait pas deviner
--  que ce prédicat vaut « jamais transféré ». Il le lira ici.
-- ---------------------------------------------------------------------

comment on view public.v_attestations_gratuites_manquantes is
  'Lots éligibles à la PREMIÈRE attestation (gratuite) et qui ne l''ont pas encore. Son prédicat `rang = 1 AND actuel` signifie « jamais transféré » — et il ne le signifie QUE parce que les rangs sont en base 1 sans trou (attributions_lot_rang_uniq + migration 20260809110000) et que l''actuel est toujours le rang maximum (attributions_lot_actuel_uniq). Avant le 09/08/2026, 441 chaînes partaient du rang 0 et leur titulaire actuel, numéroté 1, passait à tort pour le détenteur d''origine : la vue en sélectionnait 838 au lieu de 397. Ne pas réintroduire de rang 0 sans relire cette vue.';

comment on view public.v_attestations_bloquees_documents is
  'Lots qui seraient éligibles à la première attestation (gratuite) mais dont les pièces manquent. Même dépendance que v_attestations_gratuites_manquantes : `rang = 1 AND actuel` ne vaut « jamais transféré » que sous la convention de base 1 posée le 09/08/2026 (migration 20260809110000). Comptait 822 lignes avant réalignement.';

comment on column public.attributions.rang is
  'Position dans la chaîne de détention du lot, BASE 1 : le rang 1 est le détenteur d''origine, le rang le plus élevé est le titulaire actuel (et porte actuel = true, garanti par attributions_lot_actuel_uniq). Sans trou ni doublon — garanti par attributions_lot_rang_uniq depuis le 09/08/2026. Toute écriture doit suivre la règle des RPC transferer_attribution / _appliquer_maj_attributions : coalesce(max(rang), 0) + 1. Réaligné le 09/08/2026 : 893 lignes sur 441 lots portaient une base 0 héritée d''un import, et 11 chaînes (lots 076-085, 159) avaient deux lignes au même rang.';
