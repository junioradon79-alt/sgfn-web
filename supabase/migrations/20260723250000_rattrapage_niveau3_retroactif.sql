-- ============================================================================
--  Rattrapage retroactif (23/07/2026)
--
--  La promotion Niveau 2 en masse est impossible (exige un nom saisi a la
--  main, aucune source pour le deriver en bulk). Le rattrapage retroactif se
--  limite donc a 2 volets :
--   1. Le relachement Niveau 1 est automatiquement retroactif via les vues
--      existantes (v_attestations_gratuites_manquantes, deja mises a jour en
--      migration 20260723210000) -- aucune nouvelle RPC necessaire.
--   2. Bascule DIRECTE en Niveau 3 pour les lots deja qualite='acquereur' au
--      moment ou leur lotissement atteint le Niveau 2 -- seul cas
--      automatisable en masse. Meme patron de seuil-confirmation que
--      generer_attestations_gratuites_manquantes (20260722180000).
--
--  Pas de creance retroactive : le rattrapage historique ne genere PAS de
--  paiement 'en_attente' de signature (signature_payee_le reste null) -- la
--  transaction est deja consommee papier, imposer 550k FCFA a retardement
--  serait un fait nouveau, pas un rattrapage administratif.
-- ============================================================================

-- Vue de decouverte manuelle (Niveau 2, nom a saisir a la main) :
create or replace view public.v_niveau2_eligibles_manuel as
  select a.lot_id, l.numero_lot, lo.nom as lotissement, att.nom as titulaire_registre, a.qualite
  from attributions a
  join attributaires att on att.id = a.attributaire_id
  join lots l on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.actuel
    and a.qualite <> 'acquereur'
    and public.lot_peut_emettre_attestation_niveau2(a.lot_id)
    and not exists (select 1 from attestations_attribution_lot where lot_id = a.lot_id);

grant select on public.v_niveau2_eligibles_manuel to authenticated;

-- Vue des lots deja vendus (qualite='acquereur') dont le lotissement atteint
-- desormais le Niveau 2 -- candidats a la bascule DIRECTE en Niveau 3.
create or replace view public.v_niveau3_retroactif_eligibles as
  select a.lot_id, a.attributaire_id, a.id as attribution_id
  from attributions a
  where a.actuel
    and a.qualite = 'acquereur'
    and public.lot_peut_emettre_attestation_niveau2(a.lot_id)
    and not exists (select 1 from attestations_attribution_lot where lot_id = a.lot_id);

grant select on public.v_niveau3_retroactif_eligibles to authenticated;

create or replace function public.rattraper_niveau3_retroactif(p_confirmation int default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row record;
  v_count int := 0;
  v_total int;
  v_seuil constant int := 20;
  v_ref text;
  v_antecedent uuid;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  select count(*) into v_total from public.v_niveau3_retroactif_eligibles;

  if v_total > v_seuil and p_confirmation is distinct from v_total then
    raise exception
      '% lots basculeraient directement en Niveau 3 (seuil : %). Pour confirmer, rappelez l''operation en indiquant exactement ce nombre.',
      v_total, v_seuil;
  end if;

  for v_row in select lot_id, attributaire_id, attribution_id from public.v_niveau3_retroactif_eligibles
  loop
    v_ref := 'ATT-ATTRIB-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_attestation_attribution'))::text, 5, '0');
    select id into v_antecedent from attestations_cession
      where lot_id = v_row.lot_id and statut <> 'revoquee' order by cree_le desc limit 1;

    insert into attestations_attribution_lot
      (lot_id, reference, statut, niveau, attribution_id, titulaire_attributaire_id,
       nom_identifie_physique, gratuite, antecedent_attestation_cession_id,
       promue_niveau3_le, date_emission, historique)
    values
      (v_row.lot_id, v_ref, 'generee', 3, v_row.attribution_id, v_row.attributaire_id,
       null, false, v_antecedent,
       now(), current_date,
       jsonb_build_array(jsonb_build_object(
         'le', now(), 'par', auth.uid(), 'rattrapage_retroactif', true, 'niveau_apres', 3)));

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('bascules', v_count, 'eligibles', v_total);
end;
$$;

revoke all on function public.rattraper_niveau3_retroactif(int) from public, anon;
grant execute on function public.rattraper_niveau3_retroactif(int) to authenticated;
