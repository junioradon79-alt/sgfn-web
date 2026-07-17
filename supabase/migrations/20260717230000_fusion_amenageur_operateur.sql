-- Fusion du rôle « aménageur » dans « opérateur ».
--
-- Dans la réalité foncière ivoirienne, l'aménageur-lotisseur EST l'opérateur du
-- lotissement : deux libellés pour un même métier. Le rôle `amenageur` n'avait
-- d'ailleurs aucun modèle de données propre (pas d'amenageur_id) et partageait
-- déjà les policies « métier » de l'opérateur. On les fusionne.

-- 1) Tout compte aménageur devient opérateur (il hérite de l'espace opérateur et
--    du scope par operateur_id). Idempotent.
update profiles set groupe = 'operateur' where groupe = 'amenageur';

-- 2) Dépréciation des grants RLS « métier » du rôle aménageur : on le retire des
--    deux policies partagées (plus aucun compte ne l'utilise, mais on évite qu'un
--    éventuel futur compte `amenageur` obtienne un accès national). Les autres
--    rôles restent STRICTEMENT inchangés — seule la valeur 'amenageur' est retirée
--    des tableaux.
alter policy lots_read_metier on lots
using (
  mon_groupe() = any (array['operateur','operateur_saisie','geometre','agent_ia','verificateur']::groupe_utilisateur[])
);

alter policy attributaires_read_metier on attributaires
using (
  mon_groupe() = any (array['operateur','operateur_saisie','geometre','agent_ia','chefferie']::groupe_utilisateur[])
);

-- La valeur d'enum `amenageur` est laissée en place (retrait d'un label d'enum
-- risqué et sans intérêt) ; elle devient simplement inutilisée.
