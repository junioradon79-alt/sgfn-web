-- Score de confiance v3 — refonte complète du calcul (remplace v1/v2 :
-- géométrie, cohérence attributaire, litige, statut des documents,
-- complétude du dossier). Le score mesure désormais la complétude de la
-- chaîne documentaire du LOTISSEMENT auquel le lot appartient (même valeur
-- pour tous les lots d'un même lotissement), pondérée ainsi :
--   - APFC (attestations_coutumieres.statut)         40 pts
--   - Guide de répartition (lotissements.guide_reference)      20 pts
--   - PV du guide de répartition (pv_numero_enregistrement)    20 pts
--   - PV d'identification physique (pv_identification_physique_numero) 20 pts
-- score_confiance_lot() garde la même signature (total seul, exécutable par
-- anon) : verifier_attestation()/verifier_document() ne changent pas leur
-- appel à cette fonction, seule la valeur retournée change de sens.

create or replace function public.calculer_score_confiance(p_lot_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with lot as (
    select l.*, i.lotissement_id
    from lots l
    join ilots i on i.id = l.ilot_id
    where l.id = p_lot_id
  ),
  lo as (
    select * from lotissements where id = (select lotissement_id from lot)
  ),
  apfc as (
    select statut
    from attestations_coutumieres
    where lotissement_id = (select lotissement_id from lot)
    order by case statut
      when 'delivree' then 0
      when 'en_cours' then 1
      when 'a_delivrer' then 2
      else 3
    end
    limit 1
  ),
  scores as (
    select
      (case (select statut from apfc)
        when 'delivree' then 40
        when 'en_cours' then 20
        when 'a_delivrer' then 10
        else 0
      end) as score_apfc,
      (case when (select guide_reference from lo) is not null then 20 else 0 end)
        as score_guide_repartition,
      (case when (select pv_numero_enregistrement from lo) is not null then 20 else 0 end)
        as score_pv_guide_repartition,
      (case when (select pv_identification_physique_numero from lo) is not null then 20 else 0 end)
        as score_pv_identification_physique
  )
  select jsonb_build_object(
    'apfc', score_apfc,
    'guide_repartition', score_guide_repartition,
    'pv_guide_repartition', score_pv_guide_repartition,
    'pv_identification_physique', score_pv_identification_physique,
    'total', score_apfc + score_guide_repartition + score_pv_guide_repartition + score_pv_identification_physique
  )
  from scores;
$function$;

revoke all on function public.calculer_score_confiance(uuid) from public;
grant execute on function public.calculer_score_confiance(uuid) to authenticated;

-- verifier_attestation() : ajoute le numéro du PV d'identification physique
-- du lotissement, à côté de guide_reference/guide_page déjà exposés.
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
    'pv_identification_physique_numero', (
      select lt.pv_identification_physique_numero from lotissements lt
      join ilots il on il.lotissement_id = lt.id
      where il.id = (select ilot_id from lot)),
    'score_confiance', public.score_confiance_lot((select id from lot))
  );
$function$;

-- verifier_document() : même ajout sur la branche apfc (numéro + date du PV
-- d'identification physique du lotissement). Les autres branches ne changent
-- pas.
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
        'pv_identification_physique_numero', (select pv_identification_physique_numero from lo),
        'pv_identification_physique_date', (select pv_identification_physique_date from lo),
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

  if exists (select 1 from pv_bornage where reference = p_ref or qr_token = p_ref) then
    return (
      with pv as (select * from pv_bornage where reference = p_ref or qr_token = p_ref),
      m as (select * from missions_geometre where id = (select mission_id from pv)),
      ge as (select * from geometres_experts where id = (select geometre_id from m)),
      lot as (select * from lots where id = (select lot_id from m))
      select jsonb_build_object(
        'type_document', 'pv_bornage',
        'reference', (select reference from pv),
        'statut_document', (select statut::text from pv),
        'geometre', (select nom from ge),
        'geometre_cabinet', (select cabinet from ge),
        'geometre_numero_ordre', (select numero_ordre from ge),
        'client', (select client_nom from m),
        'lieu', (select lieu from m),
        'lot', (select numero_lot from lot),
        'date_bornage', (select date_bornage from pv),
        'superficie_mesuree_m2', (select superficie_mesuree_m2 from pv),
        'superficie_enregistree_m2', (select superficie_m2 from lot),
        'sig_demandeur', (select sig_demandeur_le is not null from pv),
        'sig_geometre', (select sig_geometre_le is not null from pv),
        'sig_autorite', (select sig_autorite_le is not null from pv)
      )
    );
  end if;

  return jsonb_build_object('type_document', null);
end;
$function$;
