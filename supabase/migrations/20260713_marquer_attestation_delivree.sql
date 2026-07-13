-- Remise physique d'une attestation de cession (13/07/2026 soir)
--
-- Jusqu'ici, "delivree" basculait automatiquement des que le PDF etait genere
-- (edge fn generation-document, flipStatutDelivree: true) -- ca conflait
-- "le document existe" et "il a ete remis au beneficiaire". Decision : ces
-- deux faits sont distincts. L'edge function ne bascule plus le statut pour
-- attestations_cession (voir index.ts v30) ; la remise devient une
-- confirmation manuelle admin/operateur via cette RPC.

alter table public.attestations_cession
  add column if not exists delivree_le timestamptz;

create or replace function public.marquer_attestation_delivree(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  update public.attestations_cession
  set statut = 'delivree', delivree_le = now()
  where id = p_id and statut = 'generee';

  if not found then
    raise exception 'Cette attestation n''est pas au statut "Generee" (remise deja enregistree, ou statut incompatible).';
  end if;
end;
$function$;

revoke all on function public.marquer_attestation_delivree(uuid) from public;
grant execute on function public.marquer_attestation_delivree(uuid) to authenticated;
