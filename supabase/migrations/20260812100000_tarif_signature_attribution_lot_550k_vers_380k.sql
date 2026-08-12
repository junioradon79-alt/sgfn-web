-- =====================================================================
--  BAISSE DU TARIF DE LA SIGNATURE CHEFFERIE DE L'ATTESTATION
--  D'ATTRIBUTION DE LOT (AAL) : 550 000 FCFA -> 380 000 FCFA (12/08/2026)
-- =====================================================================
--
--  Decision du proprietaire du projet (12/08/2026) : le tarif du paiement
--  de signature Chefferie qui bloque `signer_attestation_attribution_lot`
--  (branche 'chefferie') passe de
--      550 000 FCFA = 500 000 chefferie + 50 000 commission SGNF
--  a
--      380 000 FCFA = 360 000 chefferie +  20 000 commission SGNF
--
--  Ce montant avait ete pose le 23/07/2026 (migration
--  20260723220000_generer_attestation_attribution_lot.sql) et explicitement
--  qualifie de « provisoire » dans la note de la ligne `tarifs` -- ce fichier
--  cloture ce provisoire par le montant definitif.
--
--  ── PERIMETRE, CONFIRME PAR EXPLORATION AVANT D'ECRIRE CE FICHIER ────────
--  Quatre endroits, et SEULEMENT quatre, portent ce montant :
--
--   1. `generer_attestation_attribution_lot(uuid, text, text)`
--      (20260723220000, ~ligne 95) : INSERT du premier paiement de
--      signature, cree en meme temps que la ligne AAL (Niveau 2 ou 3).
--   2. `_maj_attribution_lot_niveau3(uuid, uuid, uuid)`
--      (20260723230000, ~ligne 57) : INSERT du paiement de signature rejoue
--      a CHAQUE transition Niveau 3 (nouveau titulaire = nouveau cycle de
--      constatation, decision actee le 23/07/2026).
--   3. `signer_attestation_attribution_lot(uuid, text)` : le message de la
--      garde `raise exception` sur la branche 'chefferie' CITE le montant en
--      toutes lettres, mais PUREMENT A TITRE INFORMATIF -- confirme par
--      lecture du corps : la garde compare `v_paye is null`
--      (`signature_payee_le`, un timestamp), jamais un montant. Changer le
--      texte ne change aucun comportement.
--
--      🔴 Le corps repris ci-dessous N'EST PAS celui du fichier source
--      20260728140000 recopie a l'aveugle : il a ete relu DIRECTEMENT en
--      production via `pg_get_functiondef('public.signer_attestation_
--      attribution_lot(uuid, text)'::regprocedure)` (lecture seule,
--      12/08/2026, AVANT d'ecrire ce fichier) pour verifier qu'aucun autre
--      `create or replace` n'etait intervenu entre le 28/07 et aujourd'hui.
--      Resultat : IDENTIQUE, caractere pres, au corps de
--      20260728140000_perimetre_operateur_attestations.sql (~ligne 154-237,
--      celle qui borne l'operateur a son perimetre). C'est donc bien cette
--      derniere version -- et pas celle, plus ancienne, de
--      20260723230000_niveau3_transition_paiement_et_transfert.sql -- qui
--      est reprise ici.
--
--   4. Table `public.tarifs`, ligne `type_demarche =
--      'signature_attribution_lot'` : purement affichee en lecture seule sur
--      `/dashboard/administration` (confirme : aucune fonction serveur ne la
--      lit). La synchroniser evite un affichage trompeur a l'admin, rien de
--      plus.
--
--  ── CE QUE CE FICHIER NE TOUCHE PAS (memes montants, dispositifs
--     DIFFERENTS, confirme par exploration) ──────────────────────────────
--   · `tarifs.enterinement_chefferie` et `tarifs.mutation_acquereur`
--     (550000/50000 chacune) : coincidence de montant, `type_demarche`
--     distinct, aucun rapport avec la signature AAL.
--   · L'edge function `verification-qr` (60000/50000/10000, consultation QR
--     payante) : sans rapport.
--   · `attestations_cession` / le tarif des cessions (paliers a partir de
--     30 000 FCFA) : dispositif distinct.
--
--  ── AUCUN IMPACT RETROACTIF ────────────────────────────────────────────
--  `attestations_attribution_lot` et `paiements` sont TOUTES DEUX VIDES en
--  production (0 ligne, confirme par exploration en lecture seule le
--  12/08/2026). Ce fichier ne fait donc AUCUN `update` sur des lignes
--  existantes de ces deux tables -- uniquement un changement de parametre
--  pour l'avenir.
--
--  ── ACL : DELIBEREMENT NON REDECLAREE ──────────────────────────────────
--  `create or replace function` CONSERVE l'ACL existante d'une fonction (la
--  signature ne change pas). Les trois fonctions ci-dessous ont ete relues
--  en `pg_proc.proacl` avant d'ecrire ce fichier :
--    generer_attestation_attribution_lot : {postgres=X, authenticated=X, service_role=X}
--    _maj_attribution_lot_niveau3        : {postgres=X, service_role=X}
--    signer_attestation_attribution_lot  : {postgres=X, authenticated=X, service_role=X}
--  Aucune ne porte de grant `PUBLIC` (`=X` sans beneficiaire) : l'event
--  trigger `evt_fonctions_neuves_fermees_a_anon` (20260730030000), qui se
--  declenche sur tout `CREATE FUNCTION` -- y compris un `CREATE OR REPLACE`
--  -- n'a donc rien a retirer ici. Precedent deja etabli dans ce depot :
--  20260728140000 avait deja recree `signer_attestation_attribution_lot`
--  sans redeclarer son ACL, pour la meme raison.
--
--  ── PIEGE CONNU DE CE DEPOT (dollar-quoting) ───────────────────────────
--  Tout bloc `do $...$` de ce fichier utilise un tag NOMME (`$verif$`), pas
--  le tag nu `$$`, precisement pour ne courir aucun risque avec un `$`
--  litteral qui se glisserait dans un commentaire `--` interne au bloc.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. generer_attestation_attribution_lot -- corps fidele a
--     20260723220000, seul le couple (montant_total, commission_sgfn) de
--     l'INSERT `paiements` change : 550000, 50000 -> 380000, 20000.
-- ---------------------------------------------------------------------

create or replace function public.generer_attestation_attribution_lot(
  p_lot_id uuid,
  p_nom_identifie_physique text,
  p_motif_derogation text default null
)
returns public.attestations_attribution_lot
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulaire record;
  v_apfc_id uuid;
  v_ref text;
  v_row public.attestations_attribution_lot;
  v_niveau int;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if nullif(btrim(coalesce(p_nom_identifie_physique, '')), '') is null then
    raise exception 'Le nom identifie physiquement est requis.';
  end if;

  if exists (select 1 from attestations_attribution_lot where lot_id = p_lot_id) then
    raise exception 'Ce lot a deja une Attestation d''Attribution de Lot (document unique, mis a jour, jamais recree).';
  end if;

  select a.id as attribution_id, a.attributaire_id, att.nom, a.qualite
    into v_titulaire
  from attributions a
  join attributaires att on att.id = a.attributaire_id
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;

  if not found then
    raise exception 'Ce lot n''a pas de titulaire actuel.';
  end if;

  if not public.lot_peut_emettre_attestation_niveau2(p_lot_id) then
    if p_motif_derogation is null or length(btrim(p_motif_derogation)) < 10 then
      raise exception '%', public.message_refus_documentaire(p_lot_id, 2);
    end if;
  end if;

  select apfc.id into v_apfc_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join attestations_coutumieres apfc on apfc.lotissement_id = lo.id
  where l.id = p_lot_id
  order by apfc.date_delivrance desc nulls last, apfc.id
  limit 1;

  v_niveau := case when v_titulaire.qualite = 'acquereur' then 3 else 2 end;
  v_ref := 'ATT-ATTRIB-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_attestation_attribution'))::text, 5, '0');

  insert into attestations_attribution_lot
    (lot_id, reference, statut, niveau, attribution_id, titulaire_attributaire_id,
     nom_identifie_physique, gratuite, apfc_id, antecedent_attestation_cession_id,
     exception, exception_motif, exception_par, exception_le, date_emission,
     promue_niveau3_le)
  values
    (p_lot_id, v_ref, 'generee', v_niveau, v_titulaire.attribution_id, v_titulaire.attributaire_id,
     btrim(p_nom_identifie_physique), (v_niveau = 2), v_apfc_id,
     (select id from attestations_cession where lot_id = p_lot_id and statut <> 'revoquee' order by cree_le desc limit 1),
     p_motif_derogation is not null, p_motif_derogation,
     case when p_motif_derogation is not null then auth.uid() end,
     case when p_motif_derogation is not null then now() end,
     current_date,
     case when v_niveau = 3 then now() end)
  returning * into v_row;

  -- Paiement de signature Chefferie : cree immediatement, en attente. La
  -- signature (migration suivante) reste bloquee tant qu'il n'est pas confirme.
  -- 🔴 12/08/2026 : montant de signature revu a la baisse -- ancien montant en
  -- tete de fichier, migration 20260812100000.
  insert into paiements (attestation_attribution_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_row.id, 'signature_attribution_lot', 380000, 20000, v_titulaire.nom, 'especes', 'en_attente_validation');

  return v_row;  -- 1re generation PDF : trg_gen_attribution_lot (AFTER INSERT)
end;
$function$;


-- ---------------------------------------------------------------------
--  2. _maj_attribution_lot_niveau3 -- corps fidele a 20260723230000, seul
--     le meme couple change dans l'INSERT `paiements`.
-- ---------------------------------------------------------------------

create or replace function public._maj_attribution_lot_niveau3(
  p_lot_id uuid, p_attribution_id uuid, p_titulaire_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rec public.attestations_attribution_lot;
  v_ancien uuid;
  v_nom text;
begin
  -- Meme garde que le backfill/reconciliation existant (rangs_attribution_
  -- version_guide) : une correction de donnees n'est pas un transfert reel.
  if coalesce(current_setting('sgnf.skip_free_attestation', true), 'off') = 'on' then
    return;
  end if;

  select titulaire_attributaire_id into v_ancien from attestations_attribution_lot where lot_id = p_lot_id;
  select nom into v_nom from attributaires where id = p_titulaire_id;

  update attestations_attribution_lot
     set attribution_id = p_attribution_id,
         titulaire_attributaire_id = p_titulaire_id,
         niveau = 3,
         gratuite = false,
         promue_niveau3_le = coalesce(promue_niveau3_le, now()),
         statut = 'generee',
         sig_proprietaire_le = null, sig_proprietaire_par = null,
         sig_operateur_le = null, sig_operateur_par = null,
         sig_chefferie_le = null, sig_chefferie_par = null,
         signature_payee_le = null,
         delivree_le = null, delivree_par = null,
         date_emission = current_date,
         maj_le = now(),
         derniere_maj_par = auth.uid(),
         historique = historique || jsonb_build_object(
           'le', now(), 'par', auth.uid(), 'ancien_titulaire', v_ancien,
           'nouveau_titulaire', p_titulaire_id, 'niveau_apres', 3)
   where lot_id = p_lot_id
   returning * into v_rec;

  if found then
    -- 🔴 12/08/2026 : meme revision de montant qu'en (1) ci-dessus -- migration
    -- 20260812100000.
    insert into paiements (attestation_attribution_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
    values (v_rec.id, 'signature_attribution_lot', 380000, 20000, v_nom, 'especes', 'en_attente_validation');

    perform public.sgfn_call_edge('generation-document', jsonb_build_object(
      'type', 'UPDATE', 'table', 'attestations_attribution_lot', 'record', to_jsonb(v_rec)));
  end if;
end;
$function$;


-- ---------------------------------------------------------------------
--  3. signer_attestation_attribution_lot -- corps repris TEL QUE LU en
--     production le 12/08/2026 via pg_get_functiondef (identique, caractere
--     pres, a 20260728140000). Seul le texte du message d'exception de la
--     garde 'chefferie' change -- purement informatif, aucune comparaison
--     de montant dans le corps (la garde porte sur `v_paye is null`).
-- ---------------------------------------------------------------------

create or replace function public.signer_attestation_attribution_lot(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe        groupe_utilisateur;
  v_statut        statut_att_cession;
  v_autorite      uuid;
  v_lot_operateur uuid;
  v_paye          timestamptz;
  v_chefferie     uuid;
  v_operateur     uuid;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id, lo.operateur_id, a.signature_payee_le
    into v_statut, v_autorite, v_lot_operateur, v_paye
  from attestations_attribution_lot a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation d''Attribution de Lot introuvable.';
  end if;

  if v_statut = 'revoquee' then
    raise exception 'Cette attestation est revoquee : elle ne peut plus etre signee.';
  end if;

  v_groupe := public.mon_groupe();

  if public.est_admin() then
    null;
  elsif v_groupe = 'operateur' then
    v_operateur := public.mon_operateur_id();
    if v_operateur is null then
      raise exception 'Votre compte n''est rattache a aucun operateur : aucune signature ne peut etre constatee.';
    end if;
    if v_lot_operateur is null or v_lot_operateur <> v_operateur then
      raise exception 'Ce lotissement ne releve pas de votre perimetre.';
    end if;
  elsif v_groupe = 'chefferie' then
    if p_signature <> 'chefferie' then
      raise exception 'La chefferie ne peut constater que la signature de la chefferie.';
    end if;
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte n''est rattache a aucune chefferie : aucune signature ne peut etre constatee.';
    end if;
    if v_autorite is null or v_autorite <> v_chefferie then
      raise exception 'Ce lotissement ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration, a l''operateur et a la chefferie.';
  end if;

  if p_signature = 'chefferie' and v_paye is null then
    raise exception 'Paiement de signature (360 000 FCFA chefferie + 20 000 FCFA commission SGNF) requis avant la signature Chefferie.';
  end if;

  if p_signature = 'proprietaire' then
    update attestations_attribution_lot
    set sig_proprietaire_le = coalesce(sig_proprietaire_le, now()),
        sig_proprietaire_par = coalesce(sig_proprietaire_par, auth.uid())
    where id = p_id;
  elsif p_signature = 'operateur' then
    update attestations_attribution_lot
    set sig_operateur_le = coalesce(sig_operateur_le, now()),
        sig_operateur_par = coalesce(sig_operateur_par, auth.uid())
    where id = p_id;
  else
    update attestations_attribution_lot
    set sig_chefferie_le = coalesce(sig_chefferie_le, now()),
        sig_chefferie_par = coalesce(sig_chefferie_par, auth.uid())
    where id = p_id;
  end if;
end;
$function$;


-- ---------------------------------------------------------------------
--  4. Table tarifs -- ligne signature_attribution_lot, synchronisee sur le
--     nouveau montant. Purement affichee (aucune fonction serveur ne lit
--     cette ligne, confirme par exploration) mais gardee juste pour
--     /dashboard/administration.
-- ---------------------------------------------------------------------

update public.tarifs
set montant_min = 380000,
    montant_max = 380000,
    commission_min = 20000,
    commission_max = 20000,
    notes = 'Signature Chefferie de l''Attestation d''Attribution de Lot -- montant definitif (12/08/2026), en baisse depuis le montant provisoire du 23/07/2026'
where type_demarche = 'signature_attribution_lot';


-- ---------------------------------------------------------------------
--  5. VERIFICATION EXECUTEE, PAS SUPPOSEE
--
--  Si un des controles echoue, la migration entiere est annulee (un seul
--  `raise exception` dans une migration transactionnelle suffit) plutot que
--  de laisser un etat a moitie applique.
-- ---------------------------------------------------------------------

do $verif$
declare
  v_def_generer text;
  v_def_maj3    text;
  v_def_signer  text;
  v_tarif       record;
  v_acl         text;
begin
  -- ── 1) generer_attestation_attribution_lot : forme concatenee (INSERT
  --      litteral, pas de message texte ici) ──────────────────────────
  v_def_generer := pg_get_functiondef(
    'public.generer_attestation_attribution_lot(uuid, text, text)'::regprocedure);

  if position('380000' in v_def_generer) = 0 or position('20000' in v_def_generer) = 0 then
    raise exception 'generer_attestation_attribution_lot : le nouveau montant (380000/20000) est ABSENT du corps deploye.';
  end if;
  if position('550000' in v_def_generer) > 0
     or position('500000' in v_def_generer) > 0
     or position('50000' in v_def_generer) > 0 then
    raise exception 'generer_attestation_attribution_lot : un montant RESIDUEL (550000/500000/50000) subsiste dans le corps deploye : %', v_def_generer;
  end if;

  -- ── 2) _maj_attribution_lot_niveau3 : meme forme concatenee ─────────
  v_def_maj3 := pg_get_functiondef(
    'public._maj_attribution_lot_niveau3(uuid, uuid, uuid)'::regprocedure);

  if position('380000' in v_def_maj3) = 0 or position('20000' in v_def_maj3) = 0 then
    raise exception '_maj_attribution_lot_niveau3 : le nouveau montant (380000/20000) est ABSENT du corps deploye.';
  end if;
  if position('550000' in v_def_maj3) > 0
     or position('500000' in v_def_maj3) > 0
     or position('50000' in v_def_maj3) > 0 then
    raise exception '_maj_attribution_lot_niveau3 : un montant RESIDUEL (550000/500000/50000) subsiste dans le corps deploye : %', v_def_maj3;
  end if;

  -- ── 3) signer_attestation_attribution_lot : le message d'erreur ecrit
  --      les milliers SEPARES PAR UNE ESPACE ('360 000', PAS '360000') --
  --      c'est la forme reellement presente dans le texte, verifiee par
  --      lecture directe de pg_get_functiondef avant d'ecrire ce fichier.
  --      Chercher '380000' colle n'aurait donc RIEN trouve et aurait fait
  --      echouer ce controle a tort : on cherche la forme qui existe pour
  --      de vrai. ────────────────────────────────────────────────────
  v_def_signer := pg_get_functiondef(
    'public.signer_attestation_attribution_lot(uuid, text)'::regprocedure);

  if position('360 000' in v_def_signer) = 0 or position('20 000' in v_def_signer) = 0 then
    raise exception 'signer_attestation_attribution_lot : le nouveau montant (360 000 / 20 000) est ABSENT du message d''erreur deploye.';
  end if;
  if position('500 000' in v_def_signer) > 0
     or position('50 000' in v_def_signer) > 0
     or position('550 000' in v_def_signer) > 0 then
    raise exception 'signer_attestation_attribution_lot : un montant RESIDUEL (500 000 / 50 000 / 550 000) subsiste dans le message d''erreur deploye : %', v_def_signer;
  end if;

  -- ── 4) Ligne tarifs ───────────────────────────────────────────────
  select montant_min, montant_max, commission_min, commission_max, actif, notes
    into v_tarif
  from public.tarifs
  where type_demarche = 'signature_attribution_lot';

  if not found then
    raise exception 'tarifs : ligne signature_attribution_lot introuvable apres update -- la ligne aurait disparu.';
  end if;

  if v_tarif.montant_min <> 380000 or v_tarif.montant_max <> 380000
     or v_tarif.commission_min <> 20000 or v_tarif.commission_max <> 20000 then
    raise exception
      'tarifs : la ligne signature_attribution_lot ne porte PAS les nouvelles valeurs (montant_min=%, montant_max=%, commission_min=%, commission_max=%).',
      v_tarif.montant_min, v_tarif.montant_max, v_tarif.commission_min, v_tarif.commission_max;
  end if;

  -- ── 4bis) DURCISSEMENT (tuple unique) : le controle (4) ci-dessus
  --      interroge deja UNE SEULE ligne (filtree par type_demarche =
  --      'signature_attribution_lot') et compare les colonnes de CETTE
  --      MEME ligne -- les valeurs ne peuvent donc pas venir d'une autre
  --      ligne. Ce second controle est ajoute quand meme, sous une forme
  --      differente (un unique WHERE qui combine les trois conditions en
  --      une seule requete), pour ne reposer sur aucune hypothese
  --      implicite sur `select ... into` : si type_demarche, montant et
  --      commission ne sont pas vrais SIMULTANEMENT sur le MEME tuple,
  --      cette requete ne trouve rien. ───────────────────────────────────
  if not exists (
    select 1 from public.tarifs
    where type_demarche = 'signature_attribution_lot'
      and montant_min = 380000 and montant_max = 380000
      and commission_min = 20000 and commission_max = 20000
  ) then
    raise exception
      'tarifs : aucune ligne ne porte SIMULTANEMENT type_demarche=signature_attribution_lot, montant=380000 et commission=20000 dans le meme tuple.';
  end if;

  -- ── 5) Contre-epreuve : les deux lignes tarifs volontairement
  --      INCHANGEES (enterinement_chefferie, mutation_acquereur) doivent
  --      rester a 550000/50000 -- une regression du `where` de l'UPDATE
  --      ci-dessus (ex. clause manquante) les aurait aussi touchees. ────
  if exists (
    select 1 from public.tarifs
    where type_demarche in ('enterinement_chefferie', 'mutation_acquereur')
      and (montant_min <> 550000 or montant_max <> 550000
           or commission_min <> 50000 or commission_max <> 50000)
  ) then
    raise exception
      'tarifs : enterinement_chefferie / mutation_acquereur ont ete modifies par erreur -- ils devaient rester a 550000/50000 (dispositifs distincts, coincidence de montant seulement).';
  end if;

  -- ── 6) ACL DES TROIS FONCTIONS : AUCUN GRANT PUBLIC RESIDUEL ──────────
  --  Defense en profondeur, apres le passage attendu de l'event trigger
  --  evt_fonctions_neuves_fermees_a_anon (20260730030000) sur ce
  --  `create or replace function`. Meme idiome que 20260730030000 : `=X`
  --  place juste apres `{` ou une virgule signale un grantee SANS NOM,
  --  donc PUBLIC -- chercher `=X/` seul aurait aussi matche
  --  `authenticated=X/...` et `service_role=X/...`, d'ou ce motif precis
  --  plutot qu'un simple `like '%=X/%'`. `has_function_privilege` est
  --  verifie EN PLUS, pas a la place : c'est le seul des deux qui capte
  --  aussi le cas `proacl` NULL (acldefault() accorde alors EXECUTE a
  --  PUBLIC sans qu'aucun aclitem ne le montre). ─────────────────────────
  v_acl := coalesce((select proacl::text from pg_catalog.pg_proc
    where oid = 'public.generer_attestation_attribution_lot(uuid, text, text)'::regprocedure), 'NULL');
  if v_acl like '{=X/%' or v_acl like '%,=X/%' then
    raise exception 'ACL : grant PUBLIC residuel sur generer_attestation_attribution_lot (proacl = %).', v_acl;
  end if;

  v_acl := coalesce((select proacl::text from pg_catalog.pg_proc
    where oid = 'public._maj_attribution_lot_niveau3(uuid, uuid, uuid)'::regprocedure), 'NULL');
  if v_acl like '{=X/%' or v_acl like '%,=X/%' then
    raise exception 'ACL : grant PUBLIC residuel sur _maj_attribution_lot_niveau3 (proacl = %).', v_acl;
  end if;

  v_acl := coalesce((select proacl::text from pg_catalog.pg_proc
    where oid = 'public.signer_attestation_attribution_lot(uuid, text)'::regprocedure), 'NULL');
  if v_acl like '{=X/%' or v_acl like '%,=X/%' then
    raise exception 'ACL : grant PUBLIC residuel sur signer_attestation_attribution_lot (proacl = %).', v_acl;
  end if;

  if pg_catalog.has_function_privilege('anon',
       'public.generer_attestation_attribution_lot(uuid, text, text)'::regprocedure, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon',
       'public._maj_attribution_lot_niveau3(uuid, uuid, uuid)'::regprocedure, 'EXECUTE')
     or pg_catalog.has_function_privilege('anon',
       'public.signer_attestation_attribution_lot(uuid, text)'::regprocedure, 'EXECUTE')
  then
    raise exception 'ACL : anon peut executer une des trois fonctions AAL -- grant inattendu.';
  end if;

  raise notice
    'Tarif signature AAL : 550000 (500000+50000) -> 380000 (360000+20000) applique et verifie sur les 3 fonctions et la ligne tarifs. enterinement_chefferie / mutation_acquereur inchanges. ACL relue : aucun grant PUBLIC, anon toujours sans EXECUTE.';
end;
$verif$;
