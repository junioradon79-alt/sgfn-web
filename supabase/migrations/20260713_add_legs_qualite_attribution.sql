-- Ajoute la qualité « legs » (bien reçu par legs / bequest) à l'enum des attributions.
-- Utilisée par le guide de répartition Koelea-Accor revu (lots 48 et 49).
-- NB : ADD VALUE doit être committé avant d'être utilisé (transaction séparée des
-- requêtes qui s'en servent) — d'où un fichier de migration dédié.
alter type public.qualite_attribution add value if not exists 'legs';
