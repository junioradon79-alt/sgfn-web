-- Restauration de l'etat de production apres les deux e2e qui ECRIVENT.
--
-- 🔴 A EXECUTER APRES CHAQUE PASSAGE de :
--      node scripts/e2e-apfc-signature.mjs      (co-signature APFC)
--      node scripts/e2e-retrait-signature.mjs   (retrait d'un constat)
--
--    powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-prod.sql
--
-- Pourquoi ces deux tests ecrivent vraiment : ils prouvent le CABLAGE, que la
-- simulation SQL ne prouve pas. Un mauvais nom de RPC ou de parametre echouerait
-- exactement comme les bugs qu'ils defendent — silencieusement, du point de vue
-- de l'utilisateur. Il n'existe pas d'environnement de test : le navigateur,
-- ici, c'est la production.
--
-- Etat de reference capture le 28/07/2026, MIS A JOUR le 29/07/2026.
-- `attestations_coutumieres` ne porte AUCUN trigger et `attestations_cession`
-- n'en porte aucun sur ces colonnes : la remise ne laisse donc pas de trace.
--
-- 🔴 CORRIGE LE 29/07/2026 — ce fichier etait devenu DESTRUCTEUR.
-- La section 1 remettait `sig_chef_village_le` a NULL, au motif que les trois
-- signatures de l'APFC etaient nulles au 28/07. Ce n'est plus vrai : deux
-- migrations du 29/07 les ont inscrites au registre comme faits historiques —
-- `20260729110000_verifier_document_chef_a_la_date` (chef de village) puis
-- `20260729150000_signature_chef_famille_apfc_koelea_accor` (chef de famille),
-- toutes deux au 10/02/2022, date de delivrance portee sur l'acte.
-- Rejouer l'ancienne section 1 aurait efface une signature du registre et fait
-- retomber l'ecran de « 2/2, Valide » a « 1/2, a signer ». Le piege a ete
-- rencontre pour de vrai : le script est appele en fin de e2e-retrait-signature,
-- qui ne touche pourtant QUE la cession.
--
-- La restauration de l'APFC ne remet donc plus a NULL : elle REPOSE l'etat de
-- reference actuel, et reste idempotente.

-- ── 1. APFC : l'etat de reference depuis le 29/07 ────────────────────────────
-- `_par` reste NULL des deux cotes, deliberement : ces constats sont anterieurs
-- a la plateforme, aucun compte ne les a poses (cf. migration 20260729150000).
update public.attestations_coutumieres
   set sig_chef_village_le  = '2022-02-10 00:00:00+00',
       sig_chef_village_par = null,
       sig_chef_famille_le  = '2022-02-10 00:00:00+00',
       sig_chef_famille_par = null,
       sig_cvgfr_le         = null
 where id = '8ab41565-c11d-4b21-a276-6fd6ac2f5d15';

-- ── 2. ATT-CESS-2026-00894 : deux constats poses le 23/07 ────────────────────
-- Les horodatages sont reecrits TELS QUELS : `annuler_signature_attestation`
-- les met a null, et une nouvelle constatation porterait la date du jour.
update public.attestations_cession
   set sig_proprietaire_le  = '2026-07-23 13:42:53.49289+00',
       sig_proprietaire_par = '7291e76a-9dd1-4989-b744-0caedc517934',
       sig_chefferie_le     = '2026-07-23 13:42:52.737118+00',
       sig_chefferie_par    = '7291e76a-9dd1-4989-b744-0caedc517934'
 where id = '10158ef8-3341-472e-9d13-a04b1e254672';

-- ── Controle ─────────────────────────────────────────────────────────────────
select 'apfc' as cible,
       (sig_chef_village_le = '2022-02-10 00:00:00+00'
        and sig_chef_famille_le = '2022-02-10 00:00:00+00'
        and sig_cvgfr_le is null) as conforme
from public.attestations_coutumieres where id = '8ab41565-c11d-4b21-a276-6fd6ac2f5d15'
union all
select 'att-cess-00894',
       (sig_proprietaire_le = '2026-07-23 13:42:53.49289+00'
        and sig_chefferie_le = '2026-07-23 13:42:52.737118+00'
        and sig_operateur_le is null)
from public.attestations_cession where id = '10158ef8-3341-472e-9d13-a04b1e254672';
