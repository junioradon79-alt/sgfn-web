-- L'operateur borne a SES lotissements sur toute la chaine de vente.
--
-- 🔴 CONSTAT. Neuf RPC du tunnel autorisaient le groupe `operateur` SANS aucun
-- controle de perimetre — verifie fonction par fonction : `mon_operateur_id()`
-- n'apparaissait dans aucune. Un operateur pouvait donc creer une cession,
-- ouvrir une vente, encaisser au guichet, facturer une attestation ou changer
-- le statut d'une demande sur le lotissement d'un CONCURRENT.
--
-- Les quatre RPC d'attestation avaient ete bornees le 28/07 (migration
-- 20260728140000) ; celles-ci ne l'etaient pas, et `facturer_attestation_cession`
-- est pourtant sur la meme chaine documentaire.
--
-- Decision du proprietaire du projet : « l'operateur ne peut agir que sur ses
-- lotissements a lui, et meme ses actions doivent etre cadrees ».
--
-- 🔴 METHODE. Les neuf corps sont repris de `pg_get_functiondef` et patches
-- MECANIQUEMENT : une seule ligne inseree apres la garde de role. Aucun corps
-- n'a ete retranscrit a la main — une coquille dans 19 Ko de plpgsql serait
-- invisible a la relecture, et ces fonctions portent la facturation.
--
-- Le perimetre passe par trois helpers, selon la cle dont dispose la fonction
-- (un lot, une demande, une vente). Chacun ne fait rien pour un admin, ne fait
-- rien pour un role qui n'est pas `operateur` (les autres gardes restent
-- maitresses), et refuse explicitement le compte non rattache — le test du NULL
-- vient AVANT la comparaison, cf. la faille corrigee le meme jour.

create or replace function public.exiger_perimetre_operateur_lot(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_mien uuid;
  v_lot  uuid;
begin
  if public.est_admin() then return; end if;
  if public.mon_groupe() <> 'operateur' then return; end if;

  v_mien := public.mon_operateur_id();
  if v_mien is null then
    raise exception 'Votre compte n''est rattache a aucun operateur : aucune operation n''est possible.';
  end if;

  select lo.operateur_id into v_lot
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id;

  if v_lot is null or v_lot <> v_mien then
    raise exception 'Ce lotissement ne releve pas de votre perimetre.';
  end if;
end;
$function$;

create or replace function public.exiger_perimetre_operateur_demande(p_demande_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lot uuid;
begin
  if public.est_admin() then return; end if;
  if public.mon_groupe() <> 'operateur' then return; end if;

  select d.lot_id into v_lot from demandes_acquisition d where d.id = p_demande_id;
  if v_lot is null then
    raise exception 'Demande introuvable.';
  end if;
  perform public.exiger_perimetre_operateur_lot(v_lot);
end;
$function$;

create or replace function public.exiger_perimetre_operateur_vente(p_vente_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lot uuid;
begin
  if public.est_admin() then return; end if;
  if public.mon_groupe() <> 'operateur' then return; end if;

  -- Le perimetre suit le LOT, pas `ventes.vendeur_operateur_id` : ce dernier
  -- est nul sur une vente de famille, et c'est le rattachement du lotissement
  -- qui fait autorite partout ailleurs (`lots_read_scope`, RLS attestations).
  select v.lot_id into v_lot from ventes v where v.id = p_vente_id;
  if v_lot is null then
    raise exception 'Vente introuvable.';
  end if;
  perform public.exiger_perimetre_operateur_lot(v_lot);
end;
$function$;

revoke all on function public.exiger_perimetre_operateur_lot(uuid) from public;
revoke all on function public.exiger_perimetre_operateur_demande(uuid) from public;
revoke all on function public.exiger_perimetre_operateur_vente(uuid) from public;
grant execute on function public.exiger_perimetre_operateur_lot(uuid) to authenticated;
grant execute on function public.exiger_perimetre_operateur_demande(uuid) to authenticated;
grant execute on function public.exiger_perimetre_operateur_vente(uuid) to authenticated;

-- ══ Les neuf fonctions, patchees ══════════════════════════════════════════════

-- ── convertir_demande_en_cession ────────────────────────────────
CREATE OR REPLACE FUNCTION public.convertir_demande_en_cession(p_demande_id uuid, p_date_cession date DEFAULT CURRENT_DATE, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem          record;
  v_attr_id      uuid;
  v_profile_attr uuid;
  v_res          jsonb;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if v_dem.statut = 'convertie' then
    raise exception 'Cette demande a déjà été convertie en cession.';
  end if;
  if v_dem.statut in ('refusee','annulee') then
    raise exception 'Impossible de convertir une demande refusée ou annulée.';
  end if;

  select attributaire_id into v_profile_attr from profiles where id = v_dem.demandeur_profile_id;
  if v_profile_attr is not null then
    v_attr_id := v_profile_attr;
    update attributaires
      set telephone = coalesce(telephone, v_dem.acquereur_telephone)
      where id = v_attr_id;
  else
    insert into attributaires (nom, type, telephone, cree_par)
    values (v_dem.acquereur_nom, 'personne_physique', v_dem.acquereur_telephone, auth.uid())
    returning id into v_attr_id;
    update profiles set attributaire_id = v_attr_id
      where id = v_dem.demandeur_profile_id and attributaire_id is null;
  end if;

  v_res := public.creer_cession(
    v_dem.lot_id,
    v_attr_id,
    coalesce(p_date_cession, current_date),
    'Cession issue de la demande d''acquisition ' || p_demande_id::text,
    p_moyen
  );

  update demandes_acquisition
  set statut = 'convertie',
      attributaire_id = v_attr_id,
      cession_id = (v_res->>'cession_id')::uuid,
      traite_par = auth.uid(),
      maj_le = now()
  where id = p_demande_id;

  return v_res || jsonb_build_object('demande_id', p_demande_id, 'attributaire_id', v_attr_id);
end;
$function$;

-- ── creer_cession ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.creer_cession(p_lot_id uuid, p_acquereur_id uuid, p_date_cession date DEFAULT CURRENT_DATE, p_observation text DEFAULT NULL::text, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lotissement   record;
  v_actuelle      record;
  v_rang          int;
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

  v_rang := v_actuelle.rang + 1;

  if v_rang = 2 then
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
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere associee : impossible de calculer le tarif de la %e attestation.', v_rang;
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

  v_statut_paie := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  insert into paiements (cession_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_cession_id, p_acquereur_id, 'attestation_cession', v_montant_total, v_commission, v_beneficiaire, p_moyen, v_statut_paie)
  returning id into v_paiement_id;

  return jsonb_build_object(
    'cession_id', v_cession_id,
    'paiement_id', v_paiement_id,
    'rang', v_rang,
    'montant_total', v_montant_total,
    'commission_sgfn', v_commission,
    'montant_reverse', v_montant_rev,
    'statut_paiement', v_statut_paie
  );
end;
$function$;

-- ── creer_paiement_echeance_suivante ────────────────────────────
CREATE OR REPLACE FUNCTION public.creer_paiement_echeance_suivante(p_vente_id uuid, p_moyen moyen_paiement DEFAULT 'orange_money'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_v    record;
  v_ech  record;
  v_nom  text;
  v_paie uuid;
  v_statut statut_paiement;
begin
  select * into v_v from ventes where id = p_vente_id;
  if not found then
    raise exception 'Vente introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur'
          or v_v.acquereur_id = public.mon_attributaire_id()) then
    raise exception 'Non autorisé.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_vente(p_vente_id);
  if v_v.type_vente <> 'echelonne' then
    raise exception 'Cette vente n''est pas échelonnée.';
  end if;
  if v_v.statut = 'soldee' then
    raise exception 'Cette vente est déjà soldée.';
  end if;

  select e.* into v_ech
  from echeances e
  where e.vente_id = p_vente_id
    and e.statut <> 'payee'
    and not exists (
      select 1 from paiements p
      where p.echeance_id = e.id
        and p.statut in ('en_attente', 'en_attente_validation', 'initie', 'confirme')
    )
  order by e.numero asc
  limit 1;
  if not found then
    raise exception 'Aucune échéance à régler (toutes réglées ou déjà en cours de règlement).';
  end if;

  v_statut := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;
  select nom into v_nom from attributaires where id = v_v.acquereur_id;

  insert into paiements (vente_id, echeance_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (p_vente_id, v_ech.id, v_v.acquereur_id, 'vente_terrain', v_ech.montant_du, 0, v_nom, p_moyen, v_statut)
  returning id into v_paie;

  return jsonb_build_object(
    'paiement_id', v_paie,
    'echeance_numero', v_ech.numero,
    'montant', v_ech.montant_du,
    'statut_paiement', v_statut
  );
end;
$function$;

-- ── creer_vente ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.creer_vente(p_demande_id uuid, p_prix numeric, p_type_vente type_vente DEFAULT 'comptant'::type_vente, p_nb_echeances integer DEFAULT 1, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem        record;
  v_prof_attr  uuid;
  v_attr       uuid;
  v_op         uuid;
  v_fam        uuid;
  v_vente      uuid;
  v_paie       uuid;
  v_statut     statut_paiement;
  v_montant    numeric;
  v_ech        record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if v_dem.statut in ('refusee', 'annulee') then
    raise exception 'Impossible de créer une vente sur une demande refusée ou annulée.';
  end if;
  if v_dem.vente_id is not null then
    raise exception 'Une vente a déjà été créée pour cette demande.';
  end if;
  if p_prix is null or p_prix <= 0 then
    raise exception 'Prix de vente invalide.';
  end if;
  if not exists (select 1 from attributions a where a.lot_id = v_dem.lot_id and a.actuel = true) then
    raise exception 'Ce lot n''a pas de titulaire actuel : vente impossible.';
  end if;
  if exists (select 1 from ventes where lot_id = v_dem.lot_id and statut = 'en_cours') then
    raise exception 'Une vente est déjà en cours pour ce lot.';
  end if;

  select lo.operateur_id, lo.famille_id into v_op, v_fam
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = v_dem.lot_id;

  select attributaire_id into v_prof_attr from profiles where id = v_dem.demandeur_profile_id;
  if v_prof_attr is not null then
    v_attr := v_prof_attr;
  else
    insert into attributaires (nom, type, telephone, cree_par)
    values (v_dem.acquereur_nom, 'personne_physique', v_dem.acquereur_telephone, auth.uid())
    returning id into v_attr;
    update profiles set attributaire_id = v_attr
      where id = v_dem.demandeur_profile_id and attributaire_id is null;
  end if;

  insert into ventes (
    lot_id, acquereur_id, vendeur_operateur_id, vendeur_famille_id,
    prix_total, type_vente, nb_echeances, taux_commission, statut, date_vente, cree_par
  ) values (
    v_dem.lot_id, v_attr, v_op, v_fam,
    p_prix, p_type_vente,
    case when p_type_vente = 'echelonne' then greatest(coalesce(p_nb_echeances, 2), 2) else 1 end,
    0, 'en_cours', current_date, auth.uid()
  )
  returning id into v_vente;

  v_statut := case when p_moyen in ('especes', 'virement') then 'en_attente_validation' else 'en_attente' end;

  if p_type_vente = 'comptant' then
    v_montant := p_prix;
    insert into paiements (vente_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
    values (v_vente, v_attr, 'vente_terrain', v_montant, 0, v_dem.acquereur_nom, p_moyen, v_statut)
    returning id into v_paie;
  else
    select * into v_ech from echeances where vente_id = v_vente and numero = 1;
    v_montant := v_ech.montant_du;
    insert into paiements (vente_id, echeance_id, acquereur_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
    values (v_vente, v_ech.id, v_attr, 'vente_terrain', v_montant, 0, v_dem.acquereur_nom, p_moyen, v_statut)
    returning id into v_paie;
  end if;

  update demandes_acquisition
  set statut = 'convertie', attributaire_id = v_attr, vente_id = v_vente,
      traite_par = auth.uid(), maj_le = now()
  where id = p_demande_id;

  return jsonb_build_object(
    'vente_id', v_vente,
    'paiement_id', v_paie,
    'montant_a_payer', v_montant,
    'type_vente', p_type_vente,
    'statut_paiement', v_statut
  );
end;
$function$;

-- ── encaisser_demande_acquisition ───────────────────────────────
CREATE OR REPLACE FUNCTION public.encaisser_demande_acquisition(p_demande_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem   record;
  v_paie  record;
  v_att   record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if v_dem.cession_id is null then
    raise exception 'Cette demande n''a pas encore été convertie en cession.';
  end if;

  select id, statut, montant_total into v_paie
  from paiements
  where cession_id = v_dem.cession_id and type = 'attestation_cession'
  order by cree_le desc
  limit 1;
  if not found then
    raise exception 'Aucun paiement d''attestation rattaché à cette cession.';
  end if;

  if v_paie.statut <> 'confirme' then
    update paiements
    set statut = 'confirme', valide_par = auth.uid(), valide_le = now()
    where id = v_paie.id;
  end if;

  select reference, qr_token, statut::text as statut into v_att
  from attestations_cession
  where cession_id = v_dem.cession_id
  order by cree_le desc
  limit 1;

  return jsonb_build_object(
    'paiement_id', v_paie.id,
    'montant', v_paie.montant_total,
    'deja_paye', (v_paie.statut = 'confirme'),
    'attestation_reference', v_att.reference,
    'attestation_qr_token', v_att.qr_token,
    'attestation_statut', v_att.statut
  );
end;
$function$;

-- ── encaisser_vente_guichet ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.encaisser_vente_guichet(p_demande_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem   record;
  v_paie  record;
  v_vente record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if v_dem.vente_id is null then
    raise exception 'Aucune vente à encaisser pour cette demande.';
  end if;

  select id, statut, montant_total into v_paie
  from paiements
  where vente_id = v_dem.vente_id and type = 'vente_terrain' and statut <> 'confirme'
  order by cree_le desc
  limit 1;
  if not found then
    raise exception 'Aucun paiement du lot en attente pour cette vente.';
  end if;

  update paiements
  set statut = 'confirme', valide_par = auth.uid(), valide_le = now()
  where id = v_paie.id;

  select statut, certificat_vente_id, montant_paye, prix_total into v_vente
  from ventes where id = v_dem.vente_id;

  return jsonb_build_object(
    'paiement_id', v_paie.id,
    'montant', v_paie.montant_total,
    'vente_statut', v_vente.statut,
    'vente_soldee', (v_vente.statut = 'soldee'),
    'certificat_id', v_vente.certificat_vente_id,
    'montant_paye', v_vente.montant_paye,
    'prix_total', v_vente.prix_total
  );
end;
$function$;

-- ── facturer_attestation_cession ────────────────────────────────
CREATE OR REPLACE FUNCTION public.facturer_attestation_cession(p_lot_id uuid, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_attr_id uuid; v_nom text; v_rang int; v_op uuid; v_ac uuid;
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

  if v_rang < 2 then
    raise exception 'La 1re attestation de ce lot est gratuite (deja generee).';
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

  if v_rang = 2 then
    select montant_min, commission_min into v_tarif
    from tarifs where type_demarche = 'delivrance_attestation_cession' and actif = true;
    if not found then raise exception 'Tarif de la 2e attestation de cession non configure (table tarifs).'; end if;
    v_montant := v_tarif.montant_min; v_commission := v_tarif.commission_min;
  else
    if v_ac is null then
      raise exception 'Ce lotissement n''a pas d''autorite coutumiere : tarif de la %e attestation impossible.', v_rang;
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

  return jsonb_build_object('cession_id', v_cession, 'paiement_id', v_paie, 'rang', v_rang,
    'montant_total', v_montant, 'commission_sgfn', v_commission, 'statut_paiement', v_statut);
end;
$function$;

-- ── facturer_attestation_demande ────────────────────────────────
CREATE OR REPLACE FUNCTION public.facturer_attestation_demande(p_demande_id uuid, p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem   record;
  v_vente record;
  v_res   jsonb;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if v_dem.vente_id is null then
    raise exception 'Aucune vente : créez d''abord la vente du lot.';
  end if;
  select statut, certificat_vente_id into v_vente from ventes where id = v_dem.vente_id;
  if v_vente.statut <> 'soldee' then
    raise exception 'La vente doit être soldée (certificat de vente émis) avant de facturer l''attestation de cession.';
  end if;
  if v_dem.cession_id is not null then
    raise exception 'L''attestation de cession a déjà été facturée pour cette demande.';
  end if;

  v_res := public.facturer_attestation_cession(v_dem.lot_id, p_moyen);

  update demandes_acquisition
  set cession_id = (v_res->>'cession_id')::uuid, traite_par = auth.uid(), maj_le = now()
  where id = p_demande_id;

  return v_res || jsonb_build_object('demande_id', p_demande_id);
end;
$function$;

-- ── maj_statut_demande_acquisition ──────────────────────────────
CREATE OR REPLACE FUNCTION public.maj_statut_demande_acquisition(p_demande_id uuid, p_statut statut_demande_acquisition, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dem record;
begin
  select * into v_dem from demandes_acquisition where id = p_demande_id;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action réservée aux administrateurs et opérateurs.';
  end if;

  -- Cadrage des actes : l'agence discute, accorde, refuse ou annule. Elle ne
  -- RAMENE PAS une demande a 'nouvelle' — cet etat est celui de l'arrivee, et
  -- y revenir effacerait la trace du traitement deja mene (note d'agence,
  -- `traite_par`) en faisant croire a une demande jamais ouverte.
  --
  -- ⚠️ 'convertie' n'est PAS traite ici : la fonction le refuse deja, quelques
  -- lignes plus bas, et pour TOUT LE MONDE — administrateur compris
  -- (« Utilisez "Convertir en cession" pour ce statut. »). Une seconde regle
  -- ici ferait doublon et, pire, mentirait : elle annoncerait un statut
  -- « reserve a l'administration » que l'administration ne peut pas poser non
  -- plus. Verifie en simulant une session admin avant de l'ecarter.
  if not public.est_admin() and p_statut = 'nouvelle' then
    raise exception 'Une demande ne peut pas etre ramenee a l''etat « nouvelle » : cela effacerait la trace de son traitement.';
  end if;
  -- 🔴 Perimetre : un operateur n'agit que sur SES lotissements.
  perform public.exiger_perimetre_operateur_demande(p_demande_id);
  if p_statut = 'convertie' then
    raise exception 'Utilisez « Convertir en cession » pour ce statut.';
  end if;
  if v_dem.statut = 'convertie' then
    raise exception 'Cette demande a déjà été convertie en cession.';
  end if;
  update demandes_acquisition
  set statut = p_statut,
      note_agence = coalesce(nullif(btrim(p_note), ''), note_agence),
      traite_par = auth.uid(),
      maj_le = now()
  where id = p_demande_id;
end;
$function$;
