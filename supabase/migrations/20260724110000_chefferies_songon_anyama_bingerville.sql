-- Alimente `autorites_coutumieres` avec les chefferies (villages ébrié) des
-- trois sous-préfectures du District Autonome d'Abidjan pour lesquelles une
-- liste de villages a pu être recoupée entre sources : Songon, Anyama (hors
-- Ebimpé, déjà en base) et Bingerville.
--
-- Recherche du 24/07 : une liste fiable de TOUTES les chefferies d'Abidjan +
-- Yamoussoukro + Lagunes + Comoé + Bas-Sassandra + Gôh-Djiboua n'est pas
-- atteignable par recherche web — Abidjan seul compterait ~60 villages
-- ébrié, Yamoussoukro 69 villages sur 4 sous-préfectures (36 chefs pour le
-- seul canton Akouè), et au-delà, seules les SOUS-PRÉFECTURES (divisions
-- administratives de l'État, pas des chefferies coutumières) sont
-- documentées de façon fiable — les insérer ici serait une erreur de modèle
-- (confondre juridiction d'État et autorité coutumière).
--
-- N'ont donc été retenus que les villages où au moins une source donne une
-- liste énumérée cohérente. Volontairement écartés de cette passe :
--  - District Autonome de Yamoussoukro (comptage global connu, 0 nom de
--    village trouvé)
--  - Communes urbaines d'Abidjan — Cocody, Attécoubé, Abobo, etc. (sources
--    contradictoires sur quelle commune rattache quel village, ex. M'Badon
--    cité à la fois pour Cocody et pour le clan Akwè de Bingerville)
--  - Brofodoumé, 4e sous-préfecture d'Abidjan (une seule localité nommée
--    trouvée : liste trop incomplète pour être utile)
--  - Districts Lagunes / Comoé / Bas-Sassandra / Gôh-Djiboua (uniquement
--    des sous-préfectures documentées, aucune chefferie villageoise)
--
-- Aucun nom de chef, numéro d'arrêté, date ni contact n'est renseigné : ce
-- sont des données de terrain à collecter, jamais à deviner (cf. le
-- précédent sur la chefferie d'Ebimpé, dont la succession s'est révélée
-- contestée dans la presse).

insert into public.autorites_coutumieres (nom, type, village) values
  -- Songon (sous-préfecture, District Autonome d'Abidjan)
  ('Chefferie de Songon-Kassemblé', 'chefferie', 'Songon-Kassemblé'),
  ('Chefferie de Songon-Dagbé', 'chefferie', 'Songon-Dagbé'),
  ('Chefferie de Songon-Agban', 'chefferie', 'Songon-Agban'),
  ('Chefferie d''Abiaté', 'chefferie', 'Abiaté'),
  ('Chefferie de Nonkouagon', 'chefferie', 'Nonkouagon'),
  ('Chefferie de Bago', 'chefferie', 'Bago'),
  ('Chefferie de Guebo', 'chefferie', 'Guebo'),
  ('Chefferie de Djepote', 'chefferie', 'Djepote'),
  -- Anyama (sous-préfecture, District Autonome d'Abidjan) — Ebimpé exclu, déjà en base
  ('Chefferie d''Ahouabo', 'chefferie', 'Ahouabo'),
  ('Chefferie d''Anyama-Adjamé', 'chefferie', 'Anyama-Adjamé'),
  ('Chefferie de Yapokoi', 'chefferie', 'Yapokoi'),
  ('Chefferie d''Akéikoi', 'chefferie', 'Akéikoi'),
  ('Chefferie d''Azaguié Blida', 'chefferie', 'Azaguié Blida'),
  ('Chefferie de Quatre Croix', 'chefferie', 'Quatre Croix'),
  ('Chefferie de Thomasset', 'chefferie', 'Thomasset'),
  ('Chefferie d''Abbébroukoi', 'chefferie', 'Abbébroukoi'),
  -- Bingerville (sous-préfecture, District Autonome d'Abidjan)
  ('Chefferie d''Ebrah', 'chefferie', 'Ebrah'),
  ('Chefferie d''Achokoi', 'chefferie', 'Achokoi'),
  ('Chefferie d''Aguien', 'chefferie', 'Aguien'),
  ('Chefferie d''Akoué Agban Bingerville', 'chefferie', 'Akoué Agban Bingerville'),
  ('Chefferie d''Akoyate', 'chefferie', 'Akoyate'),
  ('Chefferie de Bregbo', 'chefferie', 'Bregbo'),
  ('Chefferie d''Eloka-Té', 'chefferie', 'Eloka-Té'),
  ('Chefferie d''Eloka-To', 'chefferie', 'Eloka-To'),
  ('Chefferie de M''Batto-Bouaké', 'chefferie', 'M''Batto-Bouaké');
