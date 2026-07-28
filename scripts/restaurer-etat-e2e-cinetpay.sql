-- Restauration apres le controle du rail EN LIGNE (CinetPay).
--
-- 🔴 A EXECUTER APRES CHAQUE PASSAGE de :
--      node scripts/e2e-cinetpay-indisponible.mjs
--
--    powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-cinetpay.sql
--
-- La table `paiements` etait VIDE au 28/07/2026 : la restauration consiste donc
-- a supprimer la seule ligne creee. Les repartitions sont supprimees d'abord
-- par prudence — le test ne doit pas en produire (elles exigent `confirme`), et
-- si le paiement en portait, c'est que quelque chose a confirme le paiement a
-- notre insu : le `select` final le montrerait.

delete from public.repartitions_paiement
 where paiement_id = 'e2ec1000-0000-4000-8000-000000000001';

delete from public.paiements
 where id = 'e2ec1000-0000-4000-8000-000000000001';

-- La consultation QR de controle. Elle etait `en_attente` : si le test l'avait
-- fait basculer en `payee`, c'est que CinetPay a repondu — donc que les secrets
-- sont poses et que ce test n'a plus lieu d'etre sous cette forme.
delete from public.consultations_qr
 where id = 'e2ec2000-0000-4000-8000-000000000002';

-- Controle final : tous les compteurs doivent etre a zero. `paiements_total` et
-- `consultations_total` sont rappeles parce qu'ils valaient 0 et 3 au
-- 28/07/2026 — un ecart signale un residu d'un autre passage.
select (select count(*) from public.paiements
         where id = 'e2ec1000-0000-4000-8000-000000000001')            as paiement_restant,
       (select count(*) from public.repartitions_paiement
         where paiement_id = 'e2ec1000-0000-4000-8000-000000000001')   as repartitions_restantes,
       (select count(*) from public.consultations_qr
         where id = 'e2ec2000-0000-4000-8000-000000000002')            as consultation_restante,
       (select count(*) from public.paiements)                         as paiements_total,
       (select count(*) from public.consultations_qr)                  as consultations_total;
