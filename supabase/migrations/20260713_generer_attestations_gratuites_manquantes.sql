-- Bouton "Générer les attestations en attente" sur le Dashboard admin (13/07/2026 soir)
--
-- Contexte : les imports/réconciliations en masse désactivent le trigger
-- trg_creer_attestation_gratuite pendant l'écriture (cf. commentaire dans
-- 20260713_kouelea_accor_reconciliation.sql). Conséquence mesurée en prod :
-- 310 lots ont une attribution rang 1 (ayant_droit/operateur, actuel) éligible
-- à l'attestation gratuite, sans qu'aucune ligne attestations_cession n'ait
-- jamais été créée pour eux.
--
-- Même règle d'éligibilité que trg_creer_attestation_gratuite / creer_attestation_gratuite_si_eligible
-- (qualite in ('ayant_droit','operateur'), rang=1, actuel=true), simplement
-- appliquée en rattrapage plutôt qu'au fil de l'eau.

-- 1. Vue de lecture : lots éligibles sans attestation. RLS des tables sous-jacentes
--    (attributions, attestations_cession) s'applique normalement à l'utilisateur
--    courant -- seul un admin obtient une liste non vide.
create or replace view public.v_attestations_gratuites_manquantes as
select a.lot_id, a.attributaire_id, a.depuis
from attributions a
where a.qualite in ('ayant_droit', 'operateur')
  and a.rang = 1
  and a.actuel = true
  and not exists (
    select 1 from attestations_cession ac
    where ac.lot_id = a.lot_id and ac.acquereur_id = a.attributaire_id
  );

grant select on public.v_attestations_gratuites_manquantes to authenticated;

-- 2. RPC de génération en masse : rejoue creer_attestation_gratuite_si_eligible
--    (même logique que le trigger, donc même garde anti-doublon) sur tous les
--    lots actuellement éligibles. Réservé aux admins.
create or replace function public.generer_attestations_gratuites_manquantes()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row record;
  v_count int := 0;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  for v_row in
    select lot_id, attributaire_id from public.v_attestations_gratuites_manquantes
  loop
    perform public.creer_attestation_gratuite_si_eligible(v_row.lot_id, v_row.attributaire_id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('generees', v_count);
end;
$function$;

revoke all on function public.generer_attestations_gratuites_manquantes() from public;
grant execute on function public.generer_attestations_gratuites_manquantes() to authenticated;
