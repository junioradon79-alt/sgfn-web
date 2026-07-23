-- ============================================================================
--  Transition Niveau 3 + signature Chefferie payante (23/07/2026)
--
--  _maj_attribution_lot_niveau3() : helper unique, appele depuis les 2 vrais
--  points d'insertion d'attribution/cession (traiter_paiement_confirme --
--  chemin payant -- et transferer_attribution -- transferts admin directs).
--  Met a jour EN PLACE la ligne unique attestations_attribution_lot (jamais
--  de nouvelle ligne), remet les signatures a zero (nouveau titulaire =
--  nouveau cycle de constatation) et cree un nouveau paiement de signature
--  (500k+50k rejoue a chaque signature requise, decision actee du 23/07).
-- ============================================================================

create or replace function public._maj_attribution_lot_niveau3(
  p_lot_id uuid, p_attribution_id uuid, p_titulaire_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
    insert into paiements (attestation_attribution_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
    values (v_rec.id, 'signature_attribution_lot', 550000, 50000, v_nom, 'especes', 'en_attente_validation');

    perform public.sgfn_call_edge('generation-document', jsonb_build_object(
      'type', 'UPDATE', 'table', 'attestations_attribution_lot', 'record', to_jsonb(v_rec)));
  end if;
end;
$$;

revoke all on function public._maj_attribution_lot_niveau3(uuid, uuid, uuid) from public, anon, authenticated;

-- ── Point de branchement #1 : traiter_paiement_confirme() ──────────────────
-- C'est cette fonction, pas creer_cession/facturer_attestation_cession, qui
-- insere reellement attestations_cession sur le chemin payant (les 2 RPC ne
-- creent que cessions/paiements ; l'attestation apparait plus tard, quand le
-- paiement passe a confirme). Verifie en lisant le fichier source.
--
-- Ajout d'une 2e branche : confirmation du paiement de signature Chefferie.

create or replace function public.traiter_paiement_confirme()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_ref text; v_total numeric; v_prix numeric;
  v_lot uuid; v_acq uuid; v_attrib_actuelle uuid;
begin
  if new.statut = 'confirme' and (tg_op='INSERT' or old.statut is distinct from 'confirme') then
    if new.confirme_le is null then new.confirme_le := now(); end if;
    if new.demarche_id is not null then
      update demarches set statut='payee_en_cours' where id=new.demarche_id and statut='en_attente_paiement';
    end if;

    if new.type='attestation_cession' and new.cession_id is not null then
      select c.lot_id, c.acquereur_id into v_lot, v_acq from cessions c where c.id = new.cession_id;

      if exists (select 1 from attestations_attribution_lot where lot_id = v_lot) then
        select a.id into v_attrib_actuelle
        from attributions a where a.lot_id = v_lot and a.actuel = true order by a.rang desc limit 1;
        perform public._maj_attribution_lot_niveau3(v_lot, v_attrib_actuelle, v_acq);
      elsif not exists (
        select 1
        from attestations_cession ac
        join cessions c on c.id = new.cession_id
        where ac.statut <> 'revoquee'
          and (ac.cession_id = new.cession_id
               or (ac.lot_id = c.lot_id and ac.acquereur_id = c.acquereur_id))
      ) then
        v_ref := 'ATT-CESS-' || to_char(now(),'YYYY') || '-' || lpad((nextval('seq_attestation'))::text,5,'0');
        insert into attestations_cession(reference, cession_id, lot_id, acquereur_id, statut)
        select v_ref, c.id, c.lot_id, c.acquereur_id, 'generee' from cessions c where c.id = new.cession_id;
      end if;
      update cessions set statut = 'solde' where id = new.cession_id and statut <> 'solde';
    end if;

    -- Nouvelle branche : paiement de signature Chefferie confirme.
    if new.type = 'signature_attribution_lot' and new.attestation_attribution_id is not null then
      update attestations_attribution_lot
      set signature_payee_le = now()
      where id = new.attestation_attribution_id;
    end if;

    if new.type='vente_terrain' and new.vente_id is not null then
      if new.echeance_id is not null then
        update echeances set montant_paye = montant_du, statut='payee', paye_le=now() where id=new.echeance_id;
      end if;
      select coalesce(sum(montant_paye),0) into v_total from echeances where vente_id = new.vente_id;
      v_total := v_total + coalesce((
        select sum(p.montant_total) from paiements p
        where p.vente_id = new.vente_id and p.echeance_id is null and p.statut='confirme' and p.id <> new.id
      ), 0);
      if new.echeance_id is null then
        v_total := v_total + new.montant_total;
      end if;
      update ventes set montant_paye = v_total where id = new.vente_id;
      select prix_total into v_prix from ventes where id = new.vente_id;
      if v_total >= v_prix then
        update ventes set statut='soldee' where id = new.vente_id;
        update cessions set statut='solde'
          where id = (select cession_id from ventes where id = new.vente_id);
      end if;
    end if;
  end if;
  return new;
end; $$;

-- ── Point de branchement #2 : transferer_attribution() ─────────────────────
-- RPC admin derriere le bouton "Transferer/Attribuer" (dashboard/lots et
-- dashboard/attributions) -- verifie directement (20260712_transfert_
-- attribution_atomique.sql), aujourd'hui sans aucun effet sur les
-- attestations. Ajout du hook Niveau 3 juste apres l'insertion de la
-- nouvelle attribution.

create or replace function public.transferer_attribution(
  p_lot_id uuid,
  p_attributaire_id uuid,
  p_qualite qualite_attribution,
  p_actuel boolean default true,
  p_depuis date default current_date,
  p_observation text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_operateur_id   uuid;
  v_actuelle       record;
  v_rang           int;
  v_attribution_id uuid;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if p_lot_id is null or p_attributaire_id is null then
    raise exception 'Lot et attributaire requis.';
  end if;

  select lo.operateur_id into v_operateur_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where l.id = p_lot_id
  for update of l;

  if not found then
    raise exception 'Lot introuvable: %', p_lot_id;
  end if;

  if not exists (select 1 from attributaires where id = p_attributaire_id) then
    raise exception 'Attributaire introuvable: %', p_attributaire_id;
  end if;

  select a.id, a.attributaire_id into v_actuelle
  from attributions a
  where a.lot_id = p_lot_id and a.actuel
  order by a.rang desc
  limit 1;

  if p_actuel and found and v_actuelle.attributaire_id = p_attributaire_id then
    raise exception 'Cet attributaire est deja le titulaire actuel du lot.';
  end if;

  if p_actuel and found then
    update attributions set actuel = false where id = v_actuelle.id;
  end if;

  select coalesce(max(rang), 0) + 1 into v_rang
  from attributions where lot_id = p_lot_id;

  insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, operateur_id, depuis, observation)
  values (p_lot_id, p_attributaire_id, p_qualite, v_rang, p_actuel, v_operateur_id, coalesce(p_depuis, current_date), p_observation)
  returning id into v_attribution_id;

  if p_actuel then
    update lots set statut = 'attribue' where id = p_lot_id;

    if exists (select 1 from attestations_attribution_lot where lot_id = p_lot_id) then
      perform public._maj_attribution_lot_niveau3(p_lot_id, v_attribution_id, p_attributaire_id);
    end if;
  end if;

  return jsonb_build_object(
    'attribution_id', v_attribution_id,
    'rang', v_rang,
    'actuel', p_actuel
  );
end;
$function$;

-- ── Signature payante : signer_attestation_attribution_lot ─────────────────
-- Copie de signer_attestation (20260722160000), avec une garde additionnelle
-- UNIQUEMENT sur la branche chefferie : le paiement de signature (500k+50k)
-- doit etre confirme (signature_payee_le not null) avant que la Chefferie
-- puisse constater sa signature. Admin/operateur constatent proprietaire/
-- operateur sans cette garde (l'enonce du user ne gate que "la signature...
-- par le Chef de Village").

create or replace function public.signer_attestation_attribution_lot(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe    groupe_utilisateur;
  v_statut    statut_att_cession;
  v_autorite  uuid;
  v_paye      timestamptz;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id, a.signature_payee_le
    into v_statut, v_autorite, v_paye
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

  if public.est_admin() or v_groupe = 'operateur' then
    null;
  elsif v_groupe = 'chefferie' then
    if p_signature <> 'chefferie' then
      raise exception 'La chefferie ne peut constater que la signature de la chefferie.';
    end if;
    if v_autorite is null or v_autorite <> public.ma_chefferie_id() then
      raise exception 'Ce lotissement ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration, a l''operateur et a la chefferie.';
  end if;

  if p_signature = 'chefferie' and v_paye is null then
    raise exception 'Paiement de signature (500 000 FCFA chefferie + 50 000 FCFA commission SGNF) requis avant la signature Chefferie.';
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

revoke all on function public.signer_attestation_attribution_lot(uuid, text) from public;
grant execute on function public.signer_attestation_attribution_lot(uuid, text) to authenticated;

create or replace function public.annuler_signature_attestation_attribution_lot(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : %.', p_signature;
  end if;

  if exists (select 1 from attestations_attribution_lot where id = p_id and statut = 'delivree') then
    raise exception 'Attestation deja delivree : retirer une signature n''aurait plus de sens.';
  end if;

  if p_signature = 'proprietaire' then
    update attestations_attribution_lot set sig_proprietaire_le = null, sig_proprietaire_par = null where id = p_id;
  elsif p_signature = 'operateur' then
    update attestations_attribution_lot set sig_operateur_le = null, sig_operateur_par = null where id = p_id;
  else
    update attestations_attribution_lot set sig_chefferie_le = null, sig_chefferie_par = null where id = p_id;
  end if;
end;
$function$;

revoke all on function public.annuler_signature_attestation_attribution_lot(uuid, text) from public;
grant execute on function public.annuler_signature_attestation_attribution_lot(uuid, text) to authenticated;

create or replace function public.marquer_attestation_attribution_lot_delivree(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requises  text[];
  v_manquantes text[] := '{}';
  v_a         record;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  select a.statut, a.sig_proprietaire_le, a.sig_operateur_le, a.sig_chefferie_le,
         lo.signatures_requises
    into v_a
  from attestations_attribution_lot a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  v_requises := coalesce(v_a.signatures_requises, array['proprietaire','operateur','chefferie']);

  if 'proprietaire' = any(v_requises) and v_a.sig_proprietaire_le is null then
    v_manquantes := v_manquantes || 'proprietaire terrien'::text;
  end if;
  if 'operateur' = any(v_requises) and v_a.sig_operateur_le is null then
    v_manquantes := v_manquantes || 'operateur'::text;
  end if;
  if 'chefferie' = any(v_requises) and v_a.sig_chefferie_le is null then
    v_manquantes := v_manquantes || 'chefferie'::text;
  end if;

  if array_length(v_manquantes, 1) > 0 then
    raise exception 'Signature(s) manquante(s) avant remise : %.', array_to_string(v_manquantes, ', ');
  end if;

  update public.attestations_attribution_lot
  set statut = 'delivree', delivree_le = now(), delivree_par = auth.uid()
  where id = p_id and statut = 'generee';

  if not found then
    raise exception 'Cette attestation n''est pas au statut "Generee" (remise deja enregistree, ou statut incompatible).';
  end if;
end;
$function$;

revoke all on function public.marquer_attestation_attribution_lot_delivree(uuid) from public;
grant execute on function public.marquer_attestation_attribution_lot_delivree(uuid) to authenticated;
