-- Vente réelle : la propriété bascule au CERTIFICAT DE VENTE (au solde), pas à la
-- cession (09/07/2026).
--
-- Modèle validé : le tunnel acquéreur = une revente réelle. L'acquéreur paie le
-- LOT (comptant ou échelonné) ; au SOLDE total, on émet le Certificat de vente et
-- on bascule la propriété (nouvelle attribution actuelle). L'attestation de cession
-- (Chefferie + Commission SGNF) est une étape SÉPARÉE, après. Les attributions
-- originelles (opérateur rang 1-2, propriétaire terrien rang 1) restent posées
-- administrativement — sans vente ni certificat.
--
-- Les triggers ventes existants généraient le certificat DÈS la création et
-- verrouillaient le lot : incompatible avec l'échelonné. On les réécrit (table à
-- 0 ligne, aucun risque).

-- 1. BEFORE INSERT : commission (0 % sur la vente), init montant_paye / solde.
create or replace function public.ventes_before_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.commission_sgfn is null then
    new.commission_sgfn := round(new.prix_total * coalesce(new.taux_commission, 0) / 100);
  end if;
  if new.montant_paye is null then new.montant_paye := 0; end if;
  if new.solde is null then new.solde := new.prix_total; end if;
  return new;
end;
$function$;

-- 2. AFTER INSERT : uniquement la mise en place des échéances (échelonné).
--    Plus de génération de certificat ni de verrou ici (déplacés au solde).
create or replace function public.ventes_after_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_base  numeric;
  v_reste numeric;
  v_i     int;
begin
  if new.type_vente = 'echelonne' and coalesce(new.nb_echeances, 0) > 1 then
    v_base  := trunc(new.prix_total / new.nb_echeances);
    v_reste := new.prix_total - v_base * new.nb_echeances;
    for v_i in 1..new.nb_echeances loop
      insert into echeances (vente_id, numero, montant_du, date_echeance, montant_paye, statut)
      values (
        new.id, v_i,
        v_base + case when v_i = new.nb_echeances then v_reste else 0 end,
        (coalesce(new.date_vente, current_date) + make_interval(months => v_i - 1))::date,
        0, 'a_venir'
      );
    end loop;
  end if;
  return new;
end;
$function$;

-- 3. AU SOLDE : émettre le certificat de vente + basculer la propriété.
--    traiter_paiement_confirme() passe ventes.statut à 'soldee' quand le total
--    payé atteint le prix ; ce trigger AFTER UPDATE réagit à cette bascule.
create or replace function public.ventes_on_soldee()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_ref   text;
  v_cert  uuid;
  v_op    uuid;
  v_rang  int;
begin
  if new.statut = 'soldee' and old.statut is distinct from 'soldee' then
    -- idempotence
    if new.certificat_vente_id is not null then
      return new;
    end if;

    -- Certificat de vente (déclenche QR + PDF via triggers existants)
    v_ref := 'CERT-VENTE-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_certificat_vente'))::text, 5, '0');
    insert into certificats_vente (reference, vente_id, lot_id, acquereur_id, statut)
    values (v_ref, new.id, new.lot_id, new.acquereur_id, 'generee')
    returning id into v_cert;
    update ventes set certificat_vente_id = v_cert where id = new.id;

    -- Bascule de propriété : nouvelle attribution actuelle pour l'acquéreur
    select lo.operateur_id into v_op
    from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = new.lot_id;

    select max(a.rang) into v_rang from attributions a where a.lot_id = new.lot_id and a.actuel = true;

    update attributions set actuel = false where lot_id = new.lot_id and actuel = true;
    insert into attributions (lot_id, attributaire_id, qualite, rang, actuel, operateur_id, depuis, observation)
    values (
      new.lot_id, new.acquereur_id, 'acquereur', coalesce(v_rang, 0) + 1, true, v_op,
      coalesce(new.date_vente, current_date),
      'Acquisition par vente ' || new.id::text
    );

    update lots set statut = 'attribue' where id = new.lot_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_ventes_soldee on public.ventes;
create trigger trg_ventes_soldee
  after update on public.ventes
  for each row execute function public.ventes_on_soldee();

-- 4. RPC creer_vente : depuis une demande d'acquisition, ouvre la vente du lot au
--    profit de l'acquéreur (vendeur = titulaire actuel via le lotissement), crée le
--    1er paiement (comptant = total ; échelonné = 1re échéance). La propriété ne
--    bascule qu'au solde (cf. trg_ventes_soldee).
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
  set statut = 'convertie', attributaire_id = v_attr, traite_par = auth.uid(), maj_le = now()
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
