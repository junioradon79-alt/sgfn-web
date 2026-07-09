-- Câblage du TUNNEL de vente réelle (09/07/2026)
--
-- Le socle est en prod (creer_vente / bascule au certificat / répartition /
-- facturer_attestation_cession). Ici on relie la DEMANDE d'acquisition à sa VENTE
-- et on outille l'agence + l'acquéreur pour piloter le parcours :
--   demande → creer_vente (prix, comptant/échelonné) → paiement du LOT
--   (guichet ou en ligne) → au solde : certificat + bascule de propriété →
--   facturer_attestation_demande (SÉQUENCE : uniquement après la vente soldée) →
--   paiement de l'ATTESTATION → attestation générée.
--
-- Les anciens convertir_demande_en_cession / encaisser_demande_acquisition
-- restent en base (compat), mais ne sont plus utilisés par le front.

-- 1. Lien demande → vente
alter table public.demandes_acquisition
  add column if not exists vente_id uuid references public.ventes(id);

-- 2. creer_vente : pose désormais aussi demandes_acquisition.vente_id, et garde
--    contre une demande déjà convertie / close. (Reste de la logique inchangé.)
create or replace function public.creer_vente(
  p_demande_id  uuid,
  p_prix        numeric,
  p_type_vente  type_vente default 'comptant',
  p_nb_echeances int default 1,
  p_moyen       moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- attributaire acquéreur (réutilise l'existant lié au profil, sinon crée + lie)
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

revoke all on function public.creer_vente(uuid, numeric, type_vente, int, moyen_paiement) from public;
grant execute on function public.creer_vente(uuid, numeric, type_vente, int, moyen_paiement) to authenticated;

-- 3. Encaissement GUICHET du paiement du lot (espèces / virement). SECURITY DEFINER
--    pour que l'opérateur (pas seulement l'admin) puisse valider — valider_paiement_manuel
--    est SECURITY INVOKER (admin-only via RLS). Confirme le paiement vente_terrain en
--    attente ; les triggers existants se chargent du solde + certificat + bascule.
create or replace function public.encaisser_vente_guichet(p_demande_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

revoke all on function public.encaisser_vente_guichet(uuid) from public;
grant execute on function public.encaisser_vente_guichet(uuid) to authenticated;

-- 4. Échelonné : créer le paiement de la PROCHAINE échéance non réglée. Appelable
--    par l'agence OU par l'acquéreur lui-même (self-service en ligne). Réglé, le
--    trigger avance le cumul ; au solde total, le certificat est émis.
create or replace function public.creer_paiement_echeance_suivante(
  p_vente_id uuid,
  p_moyen    moyen_paiement default 'orange_money'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

revoke all on function public.creer_paiement_echeance_suivante(uuid, moyen_paiement) from public;
grant execute on function public.creer_paiement_echeance_suivante(uuid, moyen_paiement) to authenticated;

-- 5. Attestation de cession depuis la demande — SÉQUENCE garantie : la vente doit
--    être SOLDÉE (certificat émis) avant de facturer, sinon on facturerait le vendeur.
--    Délègue à facturer_attestation_cession (titulaire actuel = acquéreur, rang >= 2)
--    et relie la cession à la demande pour l'affichage.
create or replace function public.facturer_attestation_demande(
  p_demande_id uuid,
  p_moyen      moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

revoke all on function public.facturer_attestation_demande(uuid, moyen_paiement) from public;
grant execute on function public.facturer_attestation_demande(uuid, moyen_paiement) to authenticated;

-- 6. Vue agence enrichie : état de la VENTE (prix, payé, solde, certificat) + le
--    paiement du lot en cours (à encaisser / payer) + l'attestation (post-vente).
--    DROP + CREATE (et non replace) : l'ajout de vente_id à la table décale d.*,
--    ce que « create or replace view » interdit (colonnes renommées).
drop view if exists public.demandes_acquisition_agence;
create view public.demandes_acquisition_agence
with (security_invoker = true) as
  select
    d.*,
    l.numero_lot,
    i.numero      as ilot_numero,
    lo.nom        as lotissement,
    lo.village,
    lo.commune,
    pr.nom_complet as demandeur_nom_complet,
    -- Vente (nouveau tunnel)
    v.statut::text     as vente_statut,
    v.type_vente::text as vente_type,
    v.prix_total       as vente_prix_total,
    v.montant_paye     as vente_montant_paye,
    (v.prix_total - coalesce(v.montant_paye, 0)) as vente_solde,
    cv.reference       as certificat_reference,
    cv.qr_token        as certificat_qr_token,
    -- Paiement du lot en cours (à encaisser au guichet / régler en ligne)
    pv.id            as vente_paiement_id,
    pv.statut::text  as vente_paiement_statut,
    pv.montant_total as vente_paiement_montant,
    -- Attestation de cession (étape post-vente)
    pa.statut::text  as paiement_statut,
    pa.montant_total as paiement_montant,
    ac.reference     as attestation_reference,
    ac.qr_token      as attestation_qr_token
  from demandes_acquisition d
  join lots l on l.id = d.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  left join profiles pr on pr.id = d.demandeur_profile_id
  left join ventes v on v.id = d.vente_id
  left join certificats_vente cv on cv.id = v.certificat_vente_id
  left join lateral (
    select id, statut, montant_total
    from paiements
    where vente_id = d.vente_id and type = 'vente_terrain' and statut <> 'confirme'
    order by cree_le desc limit 1
  ) pv on true
  left join lateral (
    select statut, montant_total
    from paiements
    where cession_id = d.cession_id and type = 'attestation_cession'
    order by cree_le desc limit 1
  ) pa on true
  left join lateral (
    select reference, qr_token
    from attestations_cession
    where cession_id = d.cession_id
    order by cree_le desc limit 1
  ) ac on true;

grant select on public.demandes_acquisition_agence to authenticated;
