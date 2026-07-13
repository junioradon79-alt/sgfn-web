-- Correction de l'opérateur du lotissement Koelea-Accor revu (13/07/2026 soir)
--
-- Le lotissement pointait vers l'opérateur "N'Cho Koutouan Jules" (créé par
-- erreur lors de la réconciliation du 13/07 -- cf. reconciliation_kouelea_accor).
-- L'opérateur réel est Guina Keke Thierry (déjà attributaire d'un lot de ce
-- même lotissement). Même mécanique que Koné Morifère / Brignan Kakodji
-- (20260713_lotissements_cadastre_metadata.sql) : création idempotente puis
-- rattachement.
--
-- N'Cho Koutouan Jules n'est utilisé comme opérateur nulle part ailleurs
-- (1 lotissement + 1 attribution historique actuel=false, tous deux ici) --
-- la ligne operateurs le concernant est laissée en l'état (non supprimée),
-- simplement débranchée.

insert into public.operateurs (nom, type)
select 'GUINA KEKE THIERRY', 'operateur'
where not exists (select 1 from public.operateurs where nom = 'GUINA KEKE THIERRY');

update public.lotissements l
set operateur_id = o.id
from public.operateurs o
where o.nom = 'GUINA KEKE THIERRY' and l.nom = 'Koelea-Accor revu';

-- La seule attribution historique (lot 49, rang 2, actuel=false) qui portait
-- encore l'ancien operateur_id.
update public.attributions a
set operateur_id = o.id
from public.operateurs o, public.lots l, public.ilots i, public.lotissements lo
where o.nom = 'GUINA KEKE THIERRY'
  and a.lot_id = l.id and l.ilot_id = i.id and i.lotissement_id = lo.id
  and lo.nom = 'Koelea-Accor revu'
  and a.operateur_id = 'a1713f00-188b-4769-9f0c-1ea217c749fc';
