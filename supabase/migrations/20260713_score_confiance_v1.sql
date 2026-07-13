-- Score de confiance v1 (Phase 1 point 3 du Document Directeur) — sans IA,
-- score sur règles calculable en SQL, 5 critères pondérés également (20 pts
-- chacun, total /100) : géométrie, cohérence attributaire, absence de litige,
-- statut des documents, complétude du dossier.
--
-- calculer_score_confiance() : détail complet, réservé au dashboard admin
-- (authenticated) — utilisé par /dashboard/lots.
-- score_confiance_lot() : total seul, exécutable sans connexion — injecté
-- dans verifier_attestation()/verifier_document() pour la page publique
-- /verifier (suit le même chemin de paywall que le reste de ces fonctions).

create or replace function public.calculer_score_confiance(p_lot_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with lot as (
    select * from lots where id = p_lot_id
  ),
  attrib_actuel as (
    select x.enterine
    from attributions x
    where x.lot_id = p_lot_id and x.actuel
    order by x.rang limit 1
  ),
  pire_litige as (
    select statut
    from litiges
    where lot_id = p_lot_id and statut <> 'clos'
    order by case statut
      when 'ouvert' then 0
      when 'en_mediation' then 1
      when 'tranche' then 2
      else 3
    end
    limit 1
  ),
  doc as (
    select statut::text as statut, sig_chefferie_le, sig_operateur_le, sig_proprietaire_le
    from attestations_cession
    where lot_id = p_lot_id
    order by cree_le desc
    limit 1
  ),
  cert as (
    select statut::text as statut
    from certificats_vente
    where lot_id = p_lot_id
    order by cree_le desc
    limit 1
  ),
  scores as (
    select
      (case when (select latitude from lot) is not null and (select longitude from lot) is not null then 20 else 0 end)
        as score_geometrie,
      (case
        when (select enterine from attrib_actuel) is true then 20
        when (select enterine from attrib_actuel) is false then 10
        else 0
      end) as score_attribution,
      (case (select statut from pire_litige)
        when 'ouvert' then 0
        when 'en_mediation' then 6
        when 'tranche' then 12
        else 20
      end) as score_litige,
      (greatest(
        case (select statut from doc) when 'delivree' then 20 when 'generee' then 10 else 0 end,
        case (select statut from cert) when 'delivree' then 20 when 'generee' then 10 else 0 end
      )) as score_documents,
      (
        (case when (select numero_parcelle from lot) is not null and (select superficie_m2 from lot) is not null then 8 else 0 end)
        + coalesce((
            select
              (case when sig_chefferie_le is not null then 4 else 0 end)
              + (case when sig_operateur_le is not null then 4 else 0 end)
              + (case when sig_proprietaire_le is not null then 4 else 0 end)
            from doc
          ), 0)
      ) as score_dossier
  )
  select jsonb_build_object(
    'geometrie', score_geometrie,
    'attribution', score_attribution,
    'litige', score_litige,
    'documents', score_documents,
    'dossier', score_dossier,
    'total', score_geometrie + score_attribution + score_litige + score_documents + score_dossier
  )
  from scores;
$function$;

revoke all on function public.calculer_score_confiance(uuid) from public;
grant execute on function public.calculer_score_confiance(uuid) to authenticated;

create or replace function public.score_confiance_lot(p_lot_id uuid)
returns int
language sql
stable security definer
set search_path to 'public'
as $function$
  select (public.calculer_score_confiance(p_lot_id)->>'total')::int;
$function$;

-- verifier_attestation() : ajout du score total (suit le même chemin de
-- paywall que le reste — voir supabase/functions/verification-qr/index.ts).
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
    'guide_page', (select guide_page from lot),
    'score_confiance', public.score_confiance_lot((select id from lot))
  );
$function$;

-- verifier_document() : même ajout sur la branche certificat_vente
-- (la branche APFC n'est pas concernée — document de lotissement, pas d'un
-- lot unique).
create or replace function public.verifier_document(p_ref text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if exists (select 1 from attestations_cession where reference = p_ref or qr_token = p_ref) then
    select jsonb_build_object('type_document', 'attestation_cession') || public.verifier_attestation(p_ref) into v_result;
    return v_result;
  end if;

  if exists (select 1 from certificats_vente where reference = p_ref or qr_token = p_ref) then
    return (
      with cv as (select * from certificats_vente where reference = p_ref or qr_token = p_ref),
      lot as (select l.* from lots l join cv on cv.lot_id = l.id)
      select jsonb_build_object(
        'type_document', 'certificat_vente',
        'reference', (select reference from cv),
        'statut_document', (select statut from cv),
        'acquereur', (select nom from attributaires where id = (select acquereur_id from cv)),
        'lot', (select numero_lot from lot),
        'ilot', (select i.numero from ilots i join lot on lot.ilot_id = i.id),
        'statut_litige', coalesce((select statut::text from litiges where lot_id = (select id from lot) and statut <> 'clos' limit 1), 'aucun'),
        'score_confiance', public.score_confiance_lot((select id from lot))
      )
    );
  end if;

  if exists (select 1 from attestations_coutumieres where reference = p_ref or numero = p_ref) then
    return (
      with apfc as (select * from attestations_coutumieres where reference = p_ref or numero = p_ref),
      lo as (select lt.* from lotissements lt join apfc on apfc.lotissement_id = lt.id)
      select jsonb_build_object(
        'type_document', 'apfc',
        'reference', (select reference from apfc),
        'statut_document', (select statut::text from apfc),
        'date_delivrance', (select date_delivrance from apfc),
        'non_contestation_imprimee', (select non_contestation from apfc),
        'lotissement', (select nom from lo),
        'village', (select village from lo),
        'commune', (select commune from lo),
        'district', (select district from lo),
        'superficie', (select superficie_texte from lo),
        'nb_ilots', (select nb_ilots from lo),
        'nb_lots', (select nb_lots from lo),
        'famille', (select nom from familles where id = (select famille_id from apfc)),
        'lignee', (select f2.nom from familles f2 where f2.id = (select lignee_id from familles where id = (select famille_id from apfc))),
        'chef_de_famille', coalesce((select chef_de_famille from apfc), (select chef_de_famille from familles where id = (select famille_id from apfc))),
        'autorite_coutumiere', (select nom from autorites_coutumieres where id = (select autorite_coutumiere_id from apfc)),
        'autorite_chef', (select chef from autorites_coutumieres where id = (select autorite_coutumiere_id from apfc)),
        'guide_reference', (select lo.guide_reference from lo),
        'guide_page_min', (select min(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'guide_page_max', (select max(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'pv_numero_enregistrement', (select pv_numero_enregistrement from lo),
        'pv_commissaire_nom', (select nom from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'pv_commissaire_etude', (select etude from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'litiges_actifs', (
          select coalesce(jsonb_agg(jsonb_build_object('lot', l2.numero_lot, 'ilot', i2.numero, 'objet', lit.objet, 'statut', lit.statut, 'ouvert_le', lit.ouvert_le)), '[]'::jsonb)
          from litiges lit
          join lots l2 on l2.id = lit.lot_id
          join ilots i2 on i2.id = l2.ilot_id
          where i2.lotissement_id = (select id from lo) and lit.statut <> 'clos'
        ),
        'nb_attestations_emises', (select count(*) from attestations_cession where apfc_id = (select id from apfc))
      )
    );
  end if;

  return jsonb_build_object('type_document', null);
end;
$function$;
