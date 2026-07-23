-- ============================================================================
--  RPC de promotion Niveau 2 : generer_attestation_attribution_lot (23/07/2026)
--
--  Action manuelle admin (comme la generation exceptionnelle du 23/07) : cree
--  la ligne UNIQUE attestations_attribution_lot pour un lot, avec le nom
--  identifie physiquement saisi a la main. Cree aussi immediatement le
--  paiement de signature Chefferie (500 000 + 50 000 FCFA), en attente --
--  la signature elle-meme (signer_attestation_attribution_lot, migration
--  suivante) restera bloquee tant que ce paiement n'est pas confirme.
--
--  Cas de rattrapage : si le titulaire actuel est deja qualite='acquereur'
--  (le lot a deja ete revendu), la ligne est creee DIRECTEMENT en niveau 3
--  (gratuite=false) -- on ne passe pas par un etat transitoire "niveau 2,
--  encore familial" qui ne correspondrait pas a la realite.
-- ============================================================================

create or replace function public.generer_attestation_attribution_lot(
  p_lot_id uuid,
  p_nom_identifie_physique text,
  p_motif_derogation text default null
)
returns public.attestations_attribution_lot
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_titulaire record;
  v_apfc_id uuid;
  v_ref text;
  v_row public.attestations_attribution_lot;
  v_niveau int;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if nullif(btrim(coalesce(p_nom_identifie_physique, '')), '') is null then
    raise exception 'Le nom identifie physiquement est requis.';
  end if;

  if exists (select 1 from attestations_attribution_lot where lot_id = p_lot_id) then
    raise exception 'Ce lot a deja une Attestation d''Attribution de Lot (document unique, mis a jour, jamais recree).';
  end if;

  select a.id as attribution_id, a.attributaire_id, att.nom, a.qualite
    into v_titulaire
  from attributions a
  join attributaires att on att.id = a.attributaire_id
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;

  if not found then
    raise exception 'Ce lot n''a pas de titulaire actuel.';
  end if;

  if not public.lot_peut_emettre_attestation_niveau2(p_lot_id) then
    if p_motif_derogation is null or length(btrim(p_motif_derogation)) < 10 then
      raise exception '%', public.message_refus_documentaire(p_lot_id, 2);
    end if;
  end if;

  select apfc.id into v_apfc_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join attestations_coutumieres apfc on apfc.lotissement_id = lo.id
  where l.id = p_lot_id
  order by apfc.date_delivrance desc nulls last, apfc.id
  limit 1;

  v_niveau := case when v_titulaire.qualite = 'acquereur' then 3 else 2 end;
  v_ref := 'ATT-ATTRIB-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_attestation_attribution'))::text, 5, '0');

  insert into attestations_attribution_lot
    (lot_id, reference, statut, niveau, attribution_id, titulaire_attributaire_id,
     nom_identifie_physique, gratuite, apfc_id, antecedent_attestation_cession_id,
     exception, exception_motif, exception_par, exception_le, date_emission,
     promue_niveau3_le)
  values
    (p_lot_id, v_ref, 'generee', v_niveau, v_titulaire.attribution_id, v_titulaire.attributaire_id,
     btrim(p_nom_identifie_physique), (v_niveau = 2), v_apfc_id,
     (select id from attestations_cession where lot_id = p_lot_id and statut <> 'revoquee' order by cree_le desc limit 1),
     p_motif_derogation is not null, p_motif_derogation,
     case when p_motif_derogation is not null then auth.uid() end,
     case when p_motif_derogation is not null then now() end,
     current_date,
     case when v_niveau = 3 then now() end)
  returning * into v_row;

  -- Paiement de signature Chefferie : cree immediatement, en attente. La
  -- signature (migration suivante) reste bloquee tant qu'il n'est pas confirme.
  insert into paiements (attestation_attribution_id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut)
  values (v_row.id, 'signature_attribution_lot', 550000, 50000, v_titulaire.nom, 'especes', 'en_attente_validation');

  return v_row;  -- 1re generation PDF : trg_gen_attribution_lot (AFTER INSERT)
end;
$$;

revoke all on function public.generer_attestation_attribution_lot(uuid, text, text) from public, anon;
grant execute on function public.generer_attestation_attribution_lot(uuid, text, text) to authenticated;
