-- Fixture du rail de paiement EN LIGNE (CinetPay).
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\preparer-etat-e2e-cinetpay.sql
--   node scripts/e2e-cinetpay-indisponible.mjs
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-cinetpay.sql
--
-- POURQUOI une fixture : `initier-paiement` ne repond 503 qu'APRES avoir
-- retrouve le paiement et verifie que l'appelant a le droit d'agir dessus
-- (index.ts:89-104, puis 106-111). Sans paiement existant, on n'atteint jamais
-- la branche « agregateur non configure » — on n'obtient qu'un 404, qui ne dit
-- rien du sujet.
--
-- 🟢 CE QUE CETTE FIXTURE NE DECLENCHE PAS, et c'est le point : les sept
--    effets lourds de `paiements` sont TOUS conditionnes a `statut = confirme`
--    (quittance numerotee, rendu PDFMonkey, email au payeur, ventilation,
--    soldes de cession, jeton marketplace). Un paiement cree `en_attente` n'en
--    declenche aucun. Seuls partent le calcul de commission, les frais
--    agregateur et le journal d'audit. La ligne est donc simplement
--    supprimable — contrairement a un paiement confirme, qui ne l'est pas.
--
-- Le paiement est porte par l'attributaire AKE AMAFIN NICODEME
-- (6b66b553-…), celui du compte client.test@sgfn.ci : le bouton « Payer » de
-- l'ecran n'apparait que pour le titulaire du paiement (`canPay` exige
-- `p.acquereur_id === currentAttributaireId`), jamais pour un admin.
--
-- `moyen = 'wave'` : un moyen NON manuel, sans quoi le front classe le
-- paiement dans le rail guichet et n'offre pas « Payer » du tout.

insert into public.paiements
  (id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, acquereur_id)
values
  ('e2ec1000-0000-4000-8000-000000000001', 'autre', 50000, 10000,
   'Controle e2e CinetPay (a supprimer)', 'wave', 'en_attente',
   '6b66b553-8230-4a11-a6c2-935573a49bdd')
on conflict (id) do nothing;

-- ── Le second canal : la consultation QR a 60 000 F ─────────────────────────
--
-- `payer-consultation-qr` ne repond 503 qu'apres avoir retrouve la consultation
-- ET verifie qu'elle n'est ni `payee` ni `annulee` (index.ts:41-65). Les trois
-- consultations en base sont TOUTES `annulee` : les viser renverrait un 400
-- « consultation annulee », qui ne dit rien de CinetPay. Un premier jet du test
-- passait ainsi au vert sur un simple parametre manquant — un controle qui
-- confirmait sa propre question. D'ou cette ligne `en_attente`, la seule qui
-- mene reellement au verrou.
insert into public.consultations_qr
  (id, reference_saisie, reference_document, type_document, code, jeton, statut)
values
  ('e2ec2000-0000-4000-8000-000000000002',
   'E2E-CTRL', 'E2E-CTRL', 'attestation_cession',
   'E2ECTRL', 'e2e-jeton-controle-cinetpay', 'en_attente')
on conflict (id) do nothing;

-- Controle : un paiement `en_attente` qui n'a rien produit, et une consultation
-- QR joignable par son jeton.
select p.id, p.statut, p.moyen, p.montant_total,
       coalesce(p.reference, '(null)')          as reference_quittance,
       coalesce(p.reference_externe, '(null)')  as reference_externe,
       (select count(*) from public.repartitions_paiement r where r.paiement_id = p.id) as repartitions,
       (select c.statut from public.consultations_qr c
         where c.id = 'e2ec2000-0000-4000-8000-000000000002')                           as consultation_qr
  from public.paiements p
 where p.id = 'e2ec1000-0000-4000-8000-000000000001';
