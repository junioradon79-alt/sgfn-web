-- Fix bug latent : marquer_paiement_recu() plante à l'exécution (09/07/2026)
--
-- La RPC est appelée par le webhook CinetPay (edge fn confirmer-paiement) à la
-- confirmation d'un paiement en ligne. Son `case ... then 'en_attente_validation'
-- else 'confirme' end` produit du `text` non casté vers l'enum statut_paiement :
--   ERROR 42804: column "statut" is of type statut_paiement but expression is of type text
-- Jamais déclenché jusqu'ici (CinetPay non activé), mais le parcours de paiement
-- en ligne échouerait dès la première confirmation. On caste explicitement le CASE.
create or replace function public.marquer_paiement_recu(p_paiement_id uuid, p_reference_externe text default null)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_seuil numeric;
  v_montant numeric;
begin
  select coalesce((valeur)::numeric, 0) into v_seuil
  from public.parametres_paiement where cle = 'seuil_validation_manuelle';

  select montant_total into v_montant from public.paiements where id = p_paiement_id;
  if v_montant is null then
    raise exception 'Paiement introuvable: %', p_paiement_id;
  end if;

  update public.paiements
  set
    statut = (case when v_montant >= coalesce(v_seuil, 0)
                   then 'en_attente_validation'
                   else 'confirme' end)::statut_paiement,
    reference_externe = coalesce(p_reference_externe, reference_externe)
  where id = p_paiement_id;
end;
$function$;
