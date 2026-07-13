-- Réconciliation ponctuelle du lotissement « Koelea-Accor revu » (c0e74efc-…)
-- à partir du guide validé repartition_Kouelea-Accor_a_valider.xlsx (13/07/2026).
--
-- Contexte : la base était déjà alignée à ~96 % avec le guide. Seuls écarts appliqués
-- (le reste du guide correspondait déjà à la base) :
--   - Lot 49 : réattribué à DJEBE AGBISSI (transmission, actuel) via un legs de la
--     CHEFFERIE VILLAGEOISE D'EBIMPE. La réattribution vers DJEBE avait été faite hors
--     de ce processus (édition concurrente) ; cette migration aligne le nom de la
--     chefferie sur le guide et pose la qualité « legs ».
--   - Lot 48 : qualité DJEBE ayant_droit -> legs (attributaire inchangé).
--   - Attestation ATT-CESS-2026-00320 (lot 49, au nom d'AKE AMAFIN NICODEME) : révoquée,
--     devenue caduque après la réattribution.
--   - Lot 34 : statut « libre » incohérent (détenteur actuel + attestation) -> « attribue ».
-- Aucun INSERT sur attributions ici -> trg_gen_attestation_gratuite ne se déclenche pas.
-- Bloc gardé : arrêt si DJEBE n'est pas le détenteur actuel du lot 49 (état concurrent).

do $$
declare
  v_chef  uuid;
  v_lot49 uuid;
  v_lot48 uuid;
  v_lot34 uuid;
  v_djebe uuid;
begin
  select id into v_djebe from public.attributaires where nom = 'DJEBE AGBISSI FREDERIC ARISTIDE';
  select l.id into v_lot49 from public.lots l join public.ilots i on i.id=l.ilot_id
    where i.lotissement_id='c0e74efc-5dad-4b38-abe9-bd6f70be9464' and l.numero_lot='49';
  select l.id into v_lot48 from public.lots l join public.ilots i on i.id=l.ilot_id
    where i.lotissement_id='c0e74efc-5dad-4b38-abe9-bd6f70be9464' and l.numero_lot='48';
  select l.id into v_lot34 from public.lots l join public.ilots i on i.id=l.ilot_id
    where i.lotissement_id='c0e74efc-5dad-4b38-abe9-bd6f70be9464' and l.numero_lot='34';

  select a.attributaire_id into v_chef from public.attributions a
    where a.lot_id=v_lot49 and a.attributaire_id <> v_djebe and not a.actuel
      and a.attributaire_id in (select id from public.attributaires where nom ilike '%CHEFFERIE%EBIMPE%')
    limit 1;

  if not exists (select 1 from public.attributions where lot_id=v_lot49 and actuel and attributaire_id=v_djebe) then
    raise exception 'Lot 49 : DJEBE n''est pas le detenteur actuel — etat concurrent inattendu, arret';
  end if;

  update public.attributaires set nom='CHEFFERIE VILLAGEOISE D''EBIMPE' where id=v_chef;
  update public.attributions set qualite='legs' where lot_id=v_lot49 and attributaire_id=v_chef;
  update public.attributions set qualite='legs' where lot_id=v_lot48 and rang=1 and qualite='ayant_droit';
  update public.attestations_cession set statut='revoquee' where reference='ATT-CESS-2026-00320' and statut='delivree';
  update public.lots set statut='attribue' where id=v_lot34 and statut='libre';
end $$;
