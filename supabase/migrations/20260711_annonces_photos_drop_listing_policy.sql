-- La lecture publique des photos passe par l'URL publique du bucket
-- (endpoint /storage/v1/object/public/..., qui ne consulte pas cette policy).
-- Le front ne fait jamais storage.from(...).list() : chaque chemin est connu
-- via la table photos_annonces. Cette policy ne servait donc qu'à permettre
-- le listing complet du bucket par n'importe qui (advisor public_bucket_allows_listing).
drop policy annonces_photos_public_read on storage.objects;
