-- ============================================================================
--  Realignement des rangs d'attribution (22/07/2026)
--
--  CONSTAT. Sur Brignan Kakodji, 441 lots portent une attribution « actuelle »
--  de rang >= 2. Aucune ne correspond a une transaction :
--
--    * 0 cession, 0 vente, 0 paiement enregistres sur ce lotissement ;
--    * les 441 lignes datent du 10 ou du 12/07/2026 -- les dates de la
--      reconciliation du Guide de Repartition -- et 427 portent explicitement
--      l'observation « Correction guide ACTU1AB » ;
--    * les appariements se croisent dans tous les sens (KONE MORIFERE figure
--      aussi bien avant qu'apres une dizaine d'ayants droit differents), ce
--      qu'une chaine de propriete ne fait jamais.
--
--  La reconciliation a AJOUTE une attribution la ou elle aurait du corriger
--  celle qui existait. `rang` n'encode donc pas la position dans la chaine de
--  propriete mais la VERSION DU GUIDE, alors que deux mecanismes s'appuient
--  dessus en lui pretant le premier sens :
--
--    1. la tarification par palier -- `creer_cession` calcule `rang + 1`, si
--       bien que la premiere vraie vente de ces lots serait facturee au rang 3,
--       au tarif chefferie (380 000 FCFA) au lieu du forfait national (30 000) ;
--    2. l'attestation gratuite, reservee au rang 1 -- ces proprietaires de
--       premier niveau en etaient exclus sans avoir rien achete.
--
--  CORRECTION (arbitrage du commanditaire, qui a confirme qu'aucune vente n'a
--  jamais eu lieu sur ce lotissement) : pour tout lot sans cession ni vente, le
--  titulaire actuel redevient le rang 1. Les lignes issues du guide perime sont
--  CONSERVEES -- passees au rang 0, hors de la chaine, avec leur rang d'origine
--  inscrit en observation. Le rang 0 n'est pas cosmetique : `registre_supervision`
--  filtre sur `rang = 1` SANS tester `actuel`, et deux lignes de rang 1 sur un
--  meme lot lui feraient designer un proprietaire d'origine au hasard.
--
--  Les 3 lots portant une cession reelle (Koelea-Accor) sont exclus : leur rang
--  dit la verite.
-- ============================================================================

-- Le trigger `trg_gen_attestation_gratuite` se declenche sur UPDATE : sans
-- cette garde, ramener 467 lignes au rang 1 declencherait la creation en masse
-- des attestations gratuites -- 26 immediatement sur Koelea, qui a son APFC,
-- avec autant de generations de PDF. C'est exactement l'operation de masse
-- silencieuse qu'on vient d'interdire ailleurs. La bascule est celle prevue
-- pour les backfills, lue par le trigger lui-meme.
select set_config('sgnf.skip_free_attestation', 'on', false);

-- Le critere tient a une contradiction interne, et non au nom d'un lotissement :
-- un titulaire de qualite `ayant_droit` ou `operateur` est un proprietaire de
-- PREMIER niveau ; le voir a un rang >= 2 est impossible autrement que par
-- erreur d'enregistrement. Les qualites qui justifient legitimement un rang >= 2
-- sont `ayant_droit_transmission` (succession), `acquereur` (achat) et `legs`.
--
-- Ce discriminant a ete etabli en comparant les deux lotissements : a
-- Koelea-Accor revu, les 26 lignes de rang 2 portent `ayant_droit_transmission`
-- et font suite a des collectifs (« Enfants OSSEPE MAMBI JEANNE » -> heritier
-- nomme) -- de vraies successions, que le critere « aucune cession enregistree »
-- aurait aplaties. La double garde cession/vente est conservee par prudence.
create temporary table _lots_a_realigner as
select ac.lot_id
from (
  select distinct on (a.lot_id) a.lot_id, a.rang, a.qualite
  from attributions a
  where a.actuel
  order by a.lot_id, a.rang desc
) ac
where ac.rang > 1
  and ac.qualite in ('ayant_droit', 'operateur')
  and not exists (select 1 from cessions c where c.lot_id = ac.lot_id)
  and not exists (select 1 from ventes   v where v.lot_id = ac.lot_id);

-- 1. Les enregistrements du guide perime sortent de la numerotation.
update attributions a
set rang = 0,
    observation = case
      when a.observation is null or btrim(a.observation) = ''
        then 'Version perimee du guide de repartition, corrigee le 22/07/2026 (rang ' || a.rang || ' d''origine).'
      else a.observation || ' | Version perimee du guide, corrigee le 22/07/2026 (rang ' || a.rang || ' d''origine).'
    end
where a.lot_id in (select lot_id from _lots_a_realigner)
  and not a.actuel
  and a.rang > 0;

-- 2. Le titulaire actuel redevient ce qu'il n'avait jamais cesse d'etre.
update attributions a
set rang = 1
where a.lot_id in (select lot_id from _lots_a_realigner)
  and a.actuel;

drop table _lots_a_realigner;

select set_config('sgnf.skip_free_attestation', 'off', false);
