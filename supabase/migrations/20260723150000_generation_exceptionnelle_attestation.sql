-- ============================================================================
--  Génération exceptionnelle d'attestation, depuis l'app (23/07/2026)
--
--  Jusqu'ici, débloquer une attestation malgré un dossier documentaire
--  incomplet ne se faisait qu'en SQL manuel (cf. les 36 attestations de
--  Koelea-Accor revu générées le 23/07) : poser la dérogation du lotissement,
--  appeler `creer_attestation_gratuite_si_eligible` lot par lot, la retirer.
--
--  Cette migration donne à l'admin un chemin direct depuis l'écran Lots :
--  scopé au SEUL lot choisi (jamais au lotissement entier -- pas de fenêtre
--  ouverte pendant laquelle un autre lot du même lotissement en profiterait),
--  et tracé sur l'attestation elle-même plutôt que sur une dérogation
--  transitoire aussitôt refermée. `exception_le` porte l'horodatage demandé.
-- ============================================================================

alter table public.attestations_cession
  add column exception boolean not null default false,
  add column exception_motif text,
  add column exception_par uuid references public.profiles(id),
  add column exception_le timestamptz;

comment on column public.attestations_cession.exception is
  'Vrai si cette attestation a ete generee par derogation admin (dossier documentaire incomplet), et non par le chemin normal.';

create or replace function public.generer_attestation_exceptionnelle(p_lot_id uuid, p_motif text)
returns public.attestations_cession
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_attributaire_id uuid;
  v_apfc_id uuid;
  v_ref text;
  v_row public.attestations_cession;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;
  if p_motif is null or length(btrim(p_motif)) < 10 then
    raise exception 'Motif requis (10 caracteres minimum).';
  end if;

  select a.attributaire_id into v_attributaire_id
  from attributions a
  where a.lot_id = p_lot_id and a.actuel = true
  order by a.rang desc
  limit 1;

  if v_attributaire_id is null then
    raise exception 'Ce lot n''a pas de titulaire actuel : impossible de generer une attestation.';
  end if;

  if exists (
    select 1 from attestations_cession ac
    where ac.lot_id = p_lot_id and ac.acquereur_id = v_attributaire_id
      and ac.statut <> 'revoquee'
  ) then
    raise exception 'Une attestation valide existe deja pour le titulaire actuel de ce lot.';
  end if;

  -- Meme resolution d'APFC que `creer_attestation_gratuite_si_eligible` :
  -- `order by` explicite pour un rattachement stable si plusieurs APFC
  -- couvrent le lotissement.
  select apfc.id into v_apfc_id
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join attestations_coutumieres apfc on apfc.lotissement_id = lo.id
  where l.id = p_lot_id
  order by apfc.date_delivrance desc nulls last, apfc.id
  limit 1;

  v_ref := 'ATT-CESS-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_attestation'))::text, 5, '0');

  insert into attestations_cession
    (reference, cession_id, lot_id, acquereur_id, apfc_id, statut, exception, exception_motif, exception_par, exception_le)
  values
    (v_ref, null, p_lot_id, v_attributaire_id, v_apfc_id, 'generee', true, btrim(p_motif), auth.uid(), now())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.generer_attestation_exceptionnelle(uuid, text) from public, anon;
grant execute on function public.generer_attestation_exceptionnelle(uuid, text) to authenticated;
