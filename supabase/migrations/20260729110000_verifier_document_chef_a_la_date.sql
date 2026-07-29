-- Brancher la vérification publique sur l'historique des chefs, et enregistrer
-- la signature historique de l'APFC de Koelea-Accor.
--
-- Suite de `20260729100000_historique_chefs_autorites_coutumieres.sql`.

-- ── 1. `verifier_document` : le chef À LA DATE DU DOCUMENT ───────────────────
--
-- Seule la branche APFC change (c'est la seule des cinq qui expose un chef).
-- Le corps est repris à l'identique de la définition en production au 29/07 —
-- ne pas le réécrire de mémoire : les branches « attestation de cession » et
-- « attribution » y ont été remaniées les 22 et 23/07.

create or replace function public.verifier_document(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_lot_id uuid;
  v_attrib_ref text;
begin
  if exists (select 1 from attestations_cession where reference = p_ref or qr_token = p_ref) then
    -- Redirection transparente : si le lot a ete promu Niveau 2/3 depuis,
    -- l'ancien QR affiche directement l'etat ACTUEL (meme reference papier,
    -- contenu a jour) -- decision actee du 23/07, pas de bandeau separe.
    select lot_id into v_lot_id from attestations_cession where reference = p_ref or qr_token = p_ref;
    select reference into v_attrib_ref from attestations_attribution_lot where lot_id = v_lot_id;
    if v_attrib_ref is not null then
      return jsonb_build_object('type_document', 'attestation_attribution') || public.verifier_attestation_attribution(v_attrib_ref);
    end if;

    select jsonb_build_object('type_document', 'attestation_cession') || public.verifier_attestation(p_ref) into v_result;
    return v_result;
  end if;

  if exists (select 1 from attestations_attribution_lot where reference = p_ref or qr_token = p_ref) then
    return jsonb_build_object('type_document', 'attestation_attribution') || public.verifier_attestation_attribution(p_ref);
  end if;

  if exists (select 1 from certificats_vente where reference = p_ref or qr_token = p_ref) then
    return (
      with cv as (select * from certificats_vente where reference = p_ref or qr_token = p_ref),
      lot as (select l.* from lots l join cv on cv.lot_id = l.id),
      lo as (
        select ilo.numero as ilot, lt.nom as lotissement, lt.commune, lt.village
        from lot
        join ilots ilo on ilo.id = lot.ilot_id
        join lotissements lt on lt.id = ilo.lotissement_id
      )
      select jsonb_build_object(
        'type_document', 'certificat_vente',
        'reference', (select reference from cv),
        'statut_document', (select statut from cv),
        'acquereur', (select nom from attributaires where id = (select acquereur_id from cv)),
        'lot', (select numero_lot from lot),
        'ilot', (select ilot from lo),
        'lotissement', (select lotissement from lo),
        'commune', (select commune from lo),
        'village', (select village from lo),
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
        -- 🔴 LISAIT `autorites_coutumieres.chef`, c'est-à-dire le chef COURANT.
        -- Un document de 2022 se retrouvait signé, aux yeux du public, par un
        -- chef nommé en 2023. Résolu par la date de délivrance de l'acte.
        'autorite_chef', (
          select c.nom from public.chef_autorite_a_la_date(
            (select autorite_coutumiere_id from apfc),
            (select date_delivrance from apfc)
          ) c
        ),
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
      lot as (select * from lots where id = (select lot_id from m)),
      lo as (
        select ilo.numero as ilot, lt.nom as lotissement, lt.commune, lt.village
        from lot
        join ilots ilo on ilo.id = lot.ilot_id
        join lotissements lt on lt.id = ilo.lotissement_id
      )
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
        'ilot', (select ilot from lo),
        'lotissement', (select lotissement from lo),
        'commune', (select commune from lo),
        'village', (select village from lo),
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

-- ── 2. La signature historique de l'APFC-EBIMPE-2022-001 ────────────────────
--
-- Le registre affirmait « en attente de la signature du chef de village » d'un
-- acte signé, délivré et non contesté depuis février 2022 — et le tableau de
-- bord de la chefferie invitait le chef ACTUEL à le signer. S'il avait cliqué,
-- `signer_apfc` aurait posé `sig_chef_village_le = now()` (2026) et
-- `sig_chef_village_par = auth.uid()` : au 29/07 le seul compte rattaché à la
-- chefferie d'Ebimpe est `manuel.chefferie@sgfn.ci`, un compte de TEST — le
-- successeur n'a toujours pas de compte (invitation SGFN-6EW6XNSY expirée le
-- 19/07). Un acte de 2022 aurait porté un constat de 2026 signé par un compte
-- de démonstration.
--
-- Date retenue : 10/02/2022, celle de délivrance, confirmée par le user comme
-- étant celle portée sur le papier.
--
-- ⚠️ `sig_chef_village_par` reste NULL, DÉLIBÉRÉMENT. Cette colonne est une clé
-- étrangère vers `profiles` et signifie « quel compte a constaté la signature ».
-- Aucun compte n'existe ni ne doit exister pour Nanan Affa Kouachy Alfred : il
-- n'est plus chef, et lui ouvrir un accès à la plateforme pour justifier une
-- ligne d'historique serait une erreur institutionnelle (décision du user du
-- 12/07). Le signataire se retrouve par `chef_autorite_a_la_date()`, pas par un
-- profil.
--
-- La combinaison (`_le` renseigné, `_par` NULL) se lit donc : fait historique
-- inscrit au registre, antérieur à la plateforme. `signer_apfc` pose toujours
-- les deux ensemble, la combinaison n'est donc pas ambiguë.
--
-- Les deux autres signatures (`chef_famille`, `cvgfr`) restent à NULL : le
-- papier les porte probablement, mais personne ne l'a établi ici. On n'inscrit
-- au registre que ce qui est constaté.

update public.attestations_coutumieres
set sig_chef_village_le = timestamptz '2022-02-10 00:00:00+00'
where reference = 'APFC-EBIMPE-2022-001'
  and sig_chef_village_le is null;

comment on column public.attestations_coutumieres.sig_chef_village_par is
  'Compte ayant CONSTATÉ la signature (FK profiles). NULL alors que sig_chef_village_le est renseigné = fait historique antérieur à la plateforme ; le signataire se retrouve via chef_autorite_a_la_date(autorite_coutumiere_id, date_delivrance).';
