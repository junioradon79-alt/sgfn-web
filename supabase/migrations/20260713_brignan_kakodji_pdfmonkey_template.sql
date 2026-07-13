-- Gabarit PDFMonkey dédié pour les attestations de cession de Brignan Kakodji (13/07/2026 soir)
--
-- Override par lotissement, pas un remplacement global : Koelea-Accor revu et
-- les futurs lotissements continuent d'utiliser le gabarit par défaut
-- (PDFMONKEY_TEMPLATE_ID_ATTESTATION_CESSION). generation-document lit cette
-- colonne en priorité pour attestations_cession (v33).
--
-- Pas de backfill des 381 attestations déjà générées pour ce lotissement
-- (décision explicite user, 13/07) -- seules les futures générations/
-- régénérations utiliseront ce gabarit.

alter table public.lotissements
  add column if not exists pdfmonkey_template_attestation_cession text;

update public.lotissements
set pdfmonkey_template_attestation_cession = '6F276C4A-6899-4EF6-8CEB-9CD3FC49F3F1'
where nom = 'Brignan Kakodji';
