-- Pièce d'identité de DJEBE AGBISSI FREDERIC ARISTIDE (13/07/2026 soir)
-- Attributaire des lots 48 et 49 (Koelea-Accor revu, legs Chefferie/DJEBE) --
-- CNI absente jusqu'ici (piece_nature/piece_num NULL). Renseignée à la
-- demande du user ; ses 2 attestations de cession (ATT-CESS-2026-00327 et
-- ATT-CESS-2026-00488) sont régénérées dans la foulée pour refléter le
-- nouveau numéro de pièce sur le PDF (action manuelle hors migration, cf.
-- session).

update public.attributaires
set piece_nature = 'CNI',
    piece_num = 'CI001340527'
where id = '768c4a47-b258-4c56-8ddf-04555f1d5463'
  and nom = 'DJEBE AGBISSI FREDERIC ARISTIDE';
