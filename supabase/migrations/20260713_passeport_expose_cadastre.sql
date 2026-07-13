-- Expose les métadonnées cadastrales du lotissement dans le Passeport parcelle.
-- Ajoute un objet `cadastre` aux réponses des documents rendus en passeport
-- (attestation_cession via verifier_attestation, certificat_vente via verifier_document).
-- Changement purement additif : la logique de paiement/gratuité est inchangée.
-- Pas de redéploiement d'edge function nécessaire (verification-qr renvoie `data` tel quel).

CREATE OR REPLACE FUNCTION public.verifier_attestation(p_ref text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with a as (select * from attestations_cession where reference = p_ref or qr_token = p_ref),
  lot as (select l.* from lots l join a on a.lot_id = l.id),
  loc as (
    select lt.nom, lt.commune, lt.village, lt.guide_reference, i.numero as ilot_numero,
           lt.livre_foncier, lt.centre_cadastral, lt.reference_plan, lt.tf_numero,
           lt.cedant, lt.beneficiaire_immatriculation, lt.geometre_expert, lt.cabinet_geometre,
           lt.date_leve_topographique, lt.nb_bornes, lt.superficie_texte,
           (select nom from operateurs where id = lt.operateur_id) as operateur_nom
    from ilots i join lotissements lt on lt.id = i.lotissement_id
    where i.id = (select ilot_id from lot)
  )
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
    'lot', (select numero_lot from lot),
    'ilot', (select ilot_numero from loc),
    'lotissement', (select nom from loc),
    'commune', (select commune from loc),
    'village', (select village from loc),
    'guide_reference', (select guide_reference from loc),
    'guide_page', (select guide_page from lot),
    'score_confiance', public.score_confiance_lot((select id from lot)),
    'lat_approx', (select round(latitude, 3) from lot),
    'lng_approx', (select round(longitude, 3) from lot),
    'nb_verifications', (select count(*) from scans_qr where resultat = 'trouve' and reference_saisie in (p_ref, (select qr_token from a))),
    'cadastre', (
      select jsonb_build_object(
        'livre_foncier', livre_foncier,
        'centre_cadastral', centre_cadastral,
        'reference_plan', reference_plan,
        'tf_numero', tf_numero,
        'cedant', cedant,
        'beneficiaire_immatriculation', beneficiaire_immatriculation,
        'geometre_expert', geometre_expert,
        'cabinet_geometre', cabinet_geometre,
        'date_leve_topographique', date_leve_topographique,
        'nb_bornes', nb_bornes,
        'superficie', superficie_texte,
        'operateur', operateur_nom
      ) from loc)
  );
$function$;

CREATE OR REPLACE FUNCTION public.verifier_document(p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      lot as (select l.* from lots l join cv on cv.lot_id = l.id),
      loc as (
        select lt.nom, lt.commune, lt.village, lt.guide_reference, i.numero as ilot_numero,
               lt.livre_foncier, lt.centre_cadastral, lt.reference_plan, lt.tf_numero,
               lt.cedant, lt.beneficiaire_immatriculation, lt.geometre_expert, lt.cabinet_geometre,
               lt.date_leve_topographique, lt.nb_bornes, lt.superficie_texte,
               (select nom from operateurs where id = lt.operateur_id) as operateur_nom
        from ilots i join lotissements lt on lt.id = i.lotissement_id
        where i.id = (select ilot_id from lot)
      )
      select jsonb_build_object(
        'type_document', 'certificat_vente',
        'reference', (select reference from cv),
        'statut_document', (select statut from cv),
        'acquereur', (select nom from attributaires where id = (select acquereur_id from cv)),
        'lot', (select numero_lot from lot),
        'ilot', (select ilot_numero from loc),
        'lotissement', (select nom from loc),
        'commune', (select commune from loc),
        'village', (select village from loc),
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
        'guide_reference', (select guide_reference from loc),
        'guide_page', (select guide_page from lot),
        'statut_litige', coalesce((select statut::text from litiges where lot_id = (select id from lot) and statut <> 'clos' limit 1), 'aucun'),
        'score_confiance', public.score_confiance_lot((select id from lot)),
        'lat_approx', (select round(latitude, 3) from lot),
        'lng_approx', (select round(longitude, 3) from lot),
        'nb_verifications', (select count(*) from scans_qr where resultat = 'trouve' and reference_saisie in (p_ref, (select qr_token from cv))),
        'cadastre', (
          select jsonb_build_object(
            'livre_foncier', livre_foncier,
            'centre_cadastral', centre_cadastral,
            'reference_plan', reference_plan,
            'tf_numero', tf_numero,
            'cedant', cedant,
            'beneficiaire_immatriculation', beneficiaire_immatriculation,
            'geometre_expert', geometre_expert,
            'cabinet_geometre', cabinet_geometre,
            'date_leve_topographique', date_leve_topographique,
            'nb_bornes', nb_bornes,
            'superficie', superficie_texte,
            'operateur', operateur_nom
          ) from loc)
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
