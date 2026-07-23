-- ============================================================================
--  revoquer_attestation_attribution_lot() (23/07/2026)
--
--  Oubliee dans la migration du 23/07 (signer/annuler_signature/marquer_
--  delivree avaient ete dupliquees, pas la revocation). Meme doctrine que
--  revoquer_attestation() sur attestations_cession : motif >= 10 caracteres,
--  admin uniquement, aucune marche arriere (une nouvelle attestation se
--  genere en cas d'erreur, on ne "de-revoque" pas), regeneration du PDF
--  filigrane via le meme canal (sgfn_call_edge).
-- ============================================================================

create or replace function public.revoquer_attestation_attribution_lot(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_statut statut_att_cession;
  v_rec    record;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if nullif(btrim(coalesce(p_motif, '')), '') is null or length(btrim(p_motif)) < 10 then
    raise exception 'Un motif de revocation d''au moins 10 caracteres est requis.';
  end if;

  select statut into v_statut from attestations_attribution_lot where id = p_id;

  if not found then
    raise exception 'Attestation d''Attribution de Lot introuvable.';
  end if;

  if v_statut = 'revoquee' then
    raise exception 'Cette attestation est deja revoquee.';
  end if;

  if v_statut not in ('generee', 'delivree') then
    raise exception 'Seule une attestation generee ou delivree peut etre revoquee (statut actuel : %).', v_statut;
  end if;

  update attestations_attribution_lot
  set statut           = 'revoquee',
      revoquee_le      = now(),
      revoquee_par     = auth.uid(),
      motif_revocation = btrim(p_motif)
  where id = p_id
  returning * into v_rec;

  perform sgfn_call_edge(
    'generation-document',
    jsonb_build_object('type','UPDATE','table','attestations_attribution_lot','record', to_jsonb(v_rec))
  );
end;
$function$;

revoke all on function public.revoquer_attestation_attribution_lot(uuid, text) from public;
grant execute on function public.revoquer_attestation_attribution_lot(uuid, text) to authenticated;
