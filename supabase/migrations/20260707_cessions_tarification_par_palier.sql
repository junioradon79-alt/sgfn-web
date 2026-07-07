-- Tarification par palier des attestations de cession (07/07/2026 soir)
--
-- 1re attestation (rang 1) : gratuite, deja geree par trg_creer_attestation_gratuite.
-- 2e attestation (rang 2)  : forfait national 30 000 FCFA (20 000 chefferie + 10 000 SGNF),
--                            reutilise la ligne tarifs.delivrance_attestation_cession.
-- 3e attestation et plus   : tarif variable par chefferie (autorite coutumiere), nouvelle
--                            table tarifs_attestation_chefferie. Montant chefferie +
--                            commission SGNF s'additionnent (total facture).
--
-- Bug corrige au passage : bloquer_double_cession() bloquait toute cession au-dela de
-- la 2e (son test `statut <> 'annulee'` matchait aussi 'solde', et rien ne passait une
-- cession attestation_cession a 'solde') -- corrige pour ne bloquer que 'en_cours'.

-- 1. Nouvelle table de tarifs par chefferie (3e attestation et suivantes)
create table public.tarifs_attestation_chefferie (
  id uuid primary key default gen_random_uuid(),
  autorite_coutumiere_id uuid not null references public.autorites_coutumieres(id) on delete cascade,
  montant_chefferie numeric,
  commission_sgfn numeric,
  actif boolean not null default true,
  notes text,
  maj_le timestamptz not null default now(),
  maj_par uuid references auth.users(id),
  constraint tarifs_attestation_chefferie_autorite_key unique (autorite_coutumiere_id)
);

alter table public.tarifs_attestation_chefferie enable row level security;

create policy tarifs_attestation_chefferie_admin_write on public.tarifs_attestation_chefferie
  for all to public using (est_admin()) with check (est_admin());
create policy tarifs_attestation_chefferie_read_authenticated on public.tarifs_attestation_chefferie
  for select to authenticated using (true);

insert into public.tarifs_attestation_chefferie (autorite_coutumiere_id, montant_chefferie, commission_sgfn, actif, notes)
values (
  'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb',
  365000,
  15000,
  true,
  'Chefferie d''Ebimpe -- 3e attestation et suivantes. 365 000 FCFA chefferie + 15 000 FCFA commission SGFN = 380 000 FCFA total.'
);

-- 2. Repurposer le tarif de la 2e attestation (forfait national fixe)
update public.tarifs
set montant_min = 30000,
    montant_max = 30000,
    commission_min = 10000,
    commission_max = 10000,
    notes = '2e attestation de cession -- forfait national : 20 000 FCFA chefferie + 10 000 FCFA commission SGFN = 30 000 FCFA. A partir de la 3e, voir tarifs_attestation_chefferie.',
    actif = true,
    maj_le = now()
where type_demarche = 'delivrance_attestation_cession';

-- 3bis. Meme correctif que bloquer_double_cession() cote index unique : la
--       contrainte uniq_cession_active (lot_id) WHERE statut <> 'annulee'
--       bloquait elle aussi toute cession au-dela de la 2e (une fois 'solde',
--       toujours <> 'annulee'). Recreee pour ne couvrir que 'en_cours'.
drop index if exists public.uniq_cession_active;
create unique index uniq_cession_active on public.cessions (lot_id) where (statut = 'en_cours');

-- 3. Corriger bloquer_double_cession() : ne bloquer que les cessions reellement en cours
create or replace function public.bloquer_double_cession()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (select 1 from cessions c where c.lot_id = new.lot_id
             and c.id <> coalesce(new.id,'00000000-0000-0000-0000-000000000000') and c.statut = 'en_cours') then
    raise exception 'Ce lot fait deja l''objet d''une cession en cours.';
  end if;
  return new;
end; $function$;

-- 4. traiter_paiement_confirme() : solder la cession une fois l'attestation generee,
--    ce qui autorise (via le correctif ci-dessus) une cession ulterieure sur le lot.
create or replace function public.traiter_paiement_confirme()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare v_ref text; v_total numeric; v_prix numeric;
begin
  if new.statut = 'confirme' and (tg_op='INSERT' or old.statut is distinct from 'confirme') then
    if new.confirme_le is null then new.confirme_le := now(); end if;
    if new.demarche_id is not null then
      update demarches set statut='payee_en_cours' where id=new.demarche_id and statut='en_attente_paiement';
    end if;
    if new.type='attestation_cession' and new.cession_id is not null then
      v_ref := 'ATT-CESS-' || to_char(now(),'YYYY') || '-' || lpad((nextval('seq_attestation'))::text,5,'0');
      insert into attestations_cession(reference, cession_id, lot_id, acquereur_id, statut)
      select v_ref, c.id, c.lot_id, c.acquereur_id, 'generee' from cessions c where c.id = new.cession_id;
      update cessions set statut = 'solde' where id = new.cession_id and statut <> 'solde';
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
end; $function$;

-- 5. RPC creer_cession() : point d'entree unique pour enregistrer un transfert (2e+)
create or replace function public.creer_cession(
  p_lot_id uuid,
  p_acquereur_id uuid,
  p_date_cession date default current_date,
  p_observation text default null,
  p_moyen moyen_paiement default 'especes'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      raise exception 'Tarif non defini pour cette chefferie (3e attestation et plus) -- contactez l''equipe SGFN pour fixer le tarif.';
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

  -- montant_reverse est une colonne generee (montant_total - commission_sgfn),
  -- ne pas l'inserer explicitement.
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

revoke all on function public.creer_cession(uuid, uuid, date, text, moyen_paiement) from public;
grant execute on function public.creer_cession(uuid, uuid, date, text, moyen_paiement) to authenticated;

-- 6. verifier_attestation() : exposer le flag "gratuite" (rang 1) pour le paywall QR,
--    et fiabiliser statut_acquereur (un lot peut desormais avoir plusieurs cessions
--    historiques 'solde', il faut cibler celle de CETTE attestation).
create or replace function public.verifier_attestation(p_ref text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with a as (select * from attestations_cession where reference = p_ref or qr_token = p_ref),
  lot as (select l.* from lots l join a on a.lot_id = l.id)
  select jsonb_build_object(
    'reference', (select reference from a),
    'statut_attestation', (select statut from a),
    'gratuite', (select cession_id is null from a),
    'proprietaire_actuel', (
      select att.nom from attributions x
      join attributaires att on att.id = x.attributaire_id
      where x.lot_id = (select id from lot) and x.actuel order by x.rang limit 1),
    'qualite_proprietaire_actuel', (
      select x.qualite from attributions x where x.lot_id = (select id from lot) and x.actuel order by x.rang limit 1),
    'historique_propriete', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nom', att.nom, 'qualite', x.qualite, 'depuis', x.depuis, 'actuel', x.actuel) order by x.depuis), '[]'::jsonb)
      from attributions x join attributaires att on att.id = x.attributaire_id where x.lot_id = (select id from lot)),
    'statut_acquereur', (select c.statut::text from cessions c where c.id = (select cession_id from a)),
    'autorite_coutumiere_apfc', (
      select ac.nom from attestations_cession a2
      join attestations_coutumieres apfc on apfc.id = a2.apfc_id
      join autorites_coutumieres ac on ac.id = apfc.autorite_coutumiere_id
      where a2.reference = p_ref or a2.qr_token = p_ref),
    'statut_litige', (
      select coalesce((select statut::text from litiges where lot_id=(select id from lot) and statut<>'clos' limit 1),'aucun')),
    'guide_reference', (
      select lt.guide_reference from lotissements lt
      join ilots il on il.lotissement_id = lt.id
      where il.id = (select ilot_id from lot)),
    'guide_page', (select guide_page from lot)
  );
$function$;
