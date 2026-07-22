-- ============================================================================
--  Verrou documentaire : score de confiance complet exige (22/07/2026)
--
--  DECISION DU COMMANDITAIRE : aucune attestation de cession ne peut etre
--  emise tant que le score de confiance du lotissement n'atteint pas 100/100.
--
--  Le verrou pose plus tot dans la journee etait plus faible que son intitule
--  ne le laissait croire : il exigeait qu'une ligne d'APFC EXISTE, sans regarder
--  son statut. Une APFC « a delivrer » -- 10 points sur 40 -- le satisfaisait.
--
--  Le score complet exige les quatre criteres de `calculer_score_confiance` :
--    * APFC au statut `delivree`                        40
--    * guide de repartition (`guide_reference`)          20
--    * PV du guide (`pv_numero_enregistrement`)          20
--    * PV d'identification physique                      20
--
--  EFFET IMMEDIAT, mesure avant application : AUCUN des deux lotissements n'est
--  a 100 (Brignan 20, Koelea 60). Plus aucune attestation n'est donc emissible
--  nulle part tant que les PV manquants ne sont pas saisis, ou qu'une derogation
--  n'est pas accordee. C'est l'effet voulu, mais il est total et immediat.
--
--  RENOMMAGE. La derogation ne porte plus sur la seule APFC : `derogation_apfc_*`
--  devient `derogation_documents_*`, et la vue des lots bloques suit. Un nom qui
--  decrit une regle perimee est exactement le defaut corrige ce matin sur `rang`
--  -- et le renommage ne coute rien ici, aucune derogation n'ayant ete posee.
-- ============================================================================

alter table public.lotissements rename column derogation_apfc_le    to derogation_documents_le;
alter table public.lotissements rename column derogation_apfc_par   to derogation_documents_par;
alter table public.lotissements rename column derogation_apfc_motif to derogation_documents_motif;

-- Renommer une colonne ne renomme pas sa contrainte : sans cette ligne, la cle
-- etrangere continuerait de s'appeler `..._derogation_apfc_par_fkey` et le nom
-- perime ressortirait dans les types generes.
alter table public.lotissements
  rename constraint lotissements_derogation_apfc_par_fkey to lotissements_derogation_documents_par_fkey;

comment on column public.lotissements.derogation_documents_le is
  'Horodatage de la derogation permettant d''emettre des attestations malgre un score de confiance incomplet. NULL = pas de derogation.';

-- ---------------------------------------------------------------------------
-- Ce qui manque, nomme
-- ---------------------------------------------------------------------------
-- Un refus qui dit « score insuffisant » oblige l'utilisateur a deviner lequel
-- des quatre criteres lui fait defaut. La fonction les nomme, et sert aussi bien
-- au message d'erreur qu'a l'affichage du registre.

create or replace function public.manques_documentaires_lot(p_lot_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with s as (select public.calculer_score_confiance(p_lot_id) as j)
  select array_remove(array[
    case when (s.j->>'apfc')::int < 40 then
      case when (s.j->>'apfc')::int = 0 then 'APFC absente'
           else 'APFC non delivree' end
    end,
    case when (s.j->>'guide_repartition')::int = 0 then 'guide de repartition' end,
    case when (s.j->>'pv_guide_repartition')::int = 0 then 'PV du guide de repartition' end,
    case when (s.j->>'pv_identification_physique')::int = 0 then 'PV d''identification physique' end
  ], null)
  from s;
$$;

-- ---------------------------------------------------------------------------
-- Le verrou lui-meme
-- ---------------------------------------------------------------------------
-- Signature et nom inchanges : les trois appelants
-- (`creer_attestation_gratuite_si_eligible`, `creer_cession`,
-- `facturer_attestation_cession`) et les deux vues heritent de la nouvelle
-- regle sans etre touches.

create or replace function public.lot_peut_emettre_attestation(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select lo.derogation_documents_le is not null
       from lots l
       join ilots i on i.id = l.ilot_id
       join lotissements lo on lo.id = i.lotissement_id
      where l.id = p_lot_id),
    false)
  or coalesce(public.score_confiance_lot(p_lot_id), 0) >= 100;
$$;

comment on function public.lot_peut_emettre_attestation(uuid) is
  'Vrai si le lotissement du lot atteint 100/100 au score de confiance, ou porte une derogation admin tracee.';

-- ---------------------------------------------------------------------------
-- Derogation : meme regle, nom honnete
-- ---------------------------------------------------------------------------

drop function if exists public.accorder_derogation_apfc(uuid, text);
drop function if exists public.retirer_derogation_apfc(uuid);

create or replace function public.accorder_derogation_documents(p_lotissement_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;
  if p_motif is null or length(btrim(p_motif)) < 10 then
    raise exception 'Motif de derogation requis (10 caracteres minimum).';
  end if;

  update lotissements
     set derogation_documents_le    = now(),
         derogation_documents_par   = auth.uid(),
         derogation_documents_motif = btrim(p_motif)
   where id = p_lotissement_id;

  if not found then
    raise exception 'Lotissement introuvable : %', p_lotissement_id;
  end if;
end;
$$;

create or replace function public.retirer_derogation_documents(p_lotissement_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  update lotissements
     set derogation_documents_le    = null,
         derogation_documents_par   = null,
         derogation_documents_motif = null
   where id = p_lotissement_id;

  if not found then
    raise exception 'Lotissement introuvable : %', p_lotissement_id;
  end if;
end;
$$;

revoke all on function public.accorder_derogation_documents(uuid, text) from public, anon;
revoke all on function public.retirer_derogation_documents(uuid)        from public, anon;
grant execute on function public.accorder_derogation_documents(uuid, text) to authenticated;
grant execute on function public.retirer_derogation_documents(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- Messages de refus : nommer les criteres manquants
-- ---------------------------------------------------------------------------

create or replace function public.message_refus_documentaire(p_lot_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select format(
    'Score de confiance incomplet (%s/100) : %s. Completez le dossier du lotissement, ou demandez une derogation a un administrateur.',
    coalesce(public.score_confiance_lot(p_lot_id), 0),
    array_to_string(public.manques_documentaires_lot(p_lot_id), ', ')
  );
$$;

-- Seule la ligne du message change dans ces deux fonctions ; le reste est
-- reconduit a l'identique.
create or replace function public.creer_cession(
  p_lot_id uuid,
  p_acquereur_id uuid,
  p_date_cession date DEFAULT CURRENT_DATE,
  p_observation text DEFAULT NULL::text,
  p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

  -- Refus place AVANT tout encaissement : refuser le document une fois l'argent
  -- pris laisserait un paiement confirme sans contrepartie.
  if not public.lot_peut_emettre_attestation(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id);
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
$$;

create or replace function public.facturer_attestation_cession(
  p_lot_id uuid,
  p_moyen moyen_paiement DEFAULT 'especes'::moyen_paiement)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attr_id uuid; v_nom text; v_rang int; v_op uuid; v_ac uuid;
  v_tarif record; v_tchef record; v_montant numeric; v_commission numeric;
  v_cession uuid; v_paie uuid; v_statut statut_paiement;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  if not public.lot_peut_emettre_attestation(p_lot_id) then
    raise exception '%', public.message_refus_documentaire(p_lot_id);
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
$$;

-- ---------------------------------------------------------------------------
-- La vue des lots bloques : nom honnete, et elle dit desormais POURQUOI
-- ---------------------------------------------------------------------------

drop view if exists public.v_attestations_bloquees_sans_apfc;

create or replace view public.v_attestations_bloquees_documents as
  select a.lot_id, a.attributaire_id, a.depuis,
         lo.id as lotissement_id, lo.nom as lotissement,
         public.score_confiance_lot(a.lot_id) as score,
         public.manques_documentaires_lot(a.lot_id) as manques
  from attributions a
  join lots l on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.qualite = any (array['ayant_droit'::qualite_attribution, 'operateur'::qualite_attribution])
    and a.rang = 1
    and a.actuel = true
    and not public.lot_peut_emettre_attestation(a.lot_id)
    and not exists (
      select 1 from attestations_cession ac
      where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
        and ac.statut <> 'revoquee'
    );

grant select on public.v_attestations_bloquees_documents to authenticated;
