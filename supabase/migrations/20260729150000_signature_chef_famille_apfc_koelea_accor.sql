-- La signature du chef de famille sur l'APFC-EBIMPE-2022-001, et rien d'autre.
--
-- Suite directe de `20260729110000_verifier_document_chef_a_la_date.sql`, qui
-- avait inscrit `sig_chef_village_le` au 10/02/2022 en laissant explicitement
-- les deux autres signatures à NULL, avec ce motif : « le papier les porte
-- probablement, mais personne ne l'a établi ici. On n'inscrit au registre que
-- ce qui est constaté. »
--
-- C'est désormais établi. Le user, le 29/07/2026 : « le Chef de Famille N'CHO
-- KOUTOUAN JULES a signé sa partie ». Même document, même papier, donc même
-- date que la signature du chef de village : le 10/02/2022, date de délivrance
-- portée sur l'acte.
--
-- ⚠️ `sig_chef_famille_par` reste NULL, DÉLIBÉRÉMENT — exactement pour la
-- raison qui a fait laisser `sig_chef_village_par` à NULL le 29/07 au matin.
-- Cette colonne est une clé étrangère vers `profiles` et signifie « quel compte
-- a CONSTATÉ la signature ». N'CHO KOUTOUAN JULES est DÉCÉDÉ (fait établi le
-- 12/07) : son profil `0be830c7-312e-4572-ba37-8df47e6dd092` existe mais porte
-- `actif = false`, et la chefferie de la lignée Ako Djebe est passée à N'CHO
-- OHOUO BONIFACE. Créditer un compte — le sien, ou celui de son successeur —
-- d'un constat qu'il n'a pas fait serait une falsification du registre.
--
-- La combinaison (`_le` renseigné, `_par` NULL) se lit donc, ici comme pour le
-- chef de village : fait historique inscrit au registre, antérieur à la
-- plateforme. `signer_apfc` pose toujours les deux ensemble (cf. migration
-- `20260728120000`), la combinaison n'est donc pas ambiguë.
--
-- `sig_cvgfr_le` reste NULL et le restera : la table `cvgfr` est VIDE dans
-- toute la base et `attestations_coutumieres.cvgfr_id` est NULL sur cette
-- ligne. Aucun Comité Villageois de Gestion Foncière Rurale n'est partie à ce
-- document — ce n'est pas une signature manquante, c'est une signature qui n'a
-- pas lieu d'être. C'est ce que l'affichage traduit désormais (voir
-- `src/lib/signatures-attestation.ts`, `signaturesApfcRequises`).

-- Idempotente par la garde `is null` : rejouée, elle ne réécrit pas
-- l'horodatage d'origine. Bornée par la référence : une seule ligne touchée.
update public.attestations_coutumieres
set sig_chef_famille_le = timestamptz '2022-02-10 00:00:00+00'
where reference = 'APFC-EBIMPE-2022-001'
  and sig_chef_famille_le is null;

comment on column public.attestations_coutumieres.sig_chef_famille_par is
  'Compte ayant CONSTATÉ la signature (FK profiles). NULL alors que sig_chef_famille_le est renseigné = fait historique antérieur à la plateforme ; le signataire est nommé par attestations_coutumieres.chef_de_famille.';
