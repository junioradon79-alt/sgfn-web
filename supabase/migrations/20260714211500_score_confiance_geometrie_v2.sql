-- Score de confiance — affine le critère "géométrie" (20 pts), qui ne mesurait
-- jusqu'ici que la présence d'un pin GPS sur le lot (latitude/longitude), un
-- signal sans rapport avec la qualité réelle d'un bornage. On le scinde en
-- deux signaux de 10 pts : position GPS (inchangé) + preuve qu'un plan de
-- géomètre réel a été téléversé et converti (documents.type = 'plan_lot' avec
-- apercu_url renseigné, cf. UploadPlanModal + convertir-plan-cad). Même
-- signature et même total pondéré (20/100) : verifier_attestation() et
-- verifier_document() ne sont pas affectées dans leur contrat, seule la
-- valeur retournée devient plus honnête.

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
      (
        (case when (select latitude from lot) is not null and (select longitude from lot) is not null then 10 else 0 end)
        + (case when exists (
            select 1 from documents
            where lot_id = p_lot_id and type = 'plan_lot' and apercu_url is not null
          ) then 10 else 0 end)
      ) as score_geometrie,
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
