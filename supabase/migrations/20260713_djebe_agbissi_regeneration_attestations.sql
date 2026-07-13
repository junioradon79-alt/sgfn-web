-- Régénération des 2 attestations de DJEBE AGBISSI FREDERIC ARISTIDE (13/07/2026 soir)
--
-- Suite à une erreur de rendu côté gabarit PDFMonkey (corrigée par le user) et à
-- l'ajout tardif du téléphone/CNI sur son profil : les 2 anciennes attestations
-- (ATT-CESS-2026-00327 lot 48, ATT-CESS-2026-00488 lot 49) sont supprimées puis
-- régénérées via creer_attestation_gratuite_si_eligible (même chemin que la
-- génération automatique), avec de nouvelles références. Vérifié avant
-- suppression : aucune contrainte FK ne référence attestations_cession.id.
--
-- Nouvelles références : ATT-CESS-2026-00799 (lot 48), ATT-CESS-2026-00800 (lot 49).
-- Statut initial "generee" (flipStatutDelivree désactivé pour attestations_cession
-- depuis ce soir, cf. 20260713_marquer_attestation_delivree.sql) -- la remise
-- physique reste à confirmer via le bouton dédié de /dashboard/documents.

delete from attestations_cession
where id in ('dca9dc69-db5d-4345-8787-87b60dc8ebe4', 'fc1d3347-fbf4-4528-8b59-db34f89d8c99');

select public.creer_attestation_gratuite_si_eligible('99135e0b-1c62-4d31-882c-1524dcb003e7', '768c4a47-b258-4c56-8ddf-04555f1d5463');
select public.creer_attestation_gratuite_si_eligible('2aac99cb-cf87-4b62-af6a-145cb5d2c57f', '768c4a47-b258-4c56-8ddf-04555f1d5463');
