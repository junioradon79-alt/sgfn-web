-- Restauration de l'etat de production apres le parcours VENDEUR.
--
-- 🔴 A EXECUTER APRES CHAQUE PASSAGE de :
--      node scripts/e2e-marketplace-vendeur.mjs --ecriture
--
--    powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-marketplace.sql
--
-- La passe de lecture (sans --ecriture) n'ecrit rien : elle n'appelle
-- `publier-annonce` que sur des cas que la fonction refuse avant toute
-- ecriture. Ce script ne la concerne pas.
--
-- Etat de reference capture le 28/07/2026, avant le premier passage.

-- ── 1. L'annonce creee par le test ──────────────────────────────────────────
-- Le lot n'en portait aucune. On supprime par lot_id et non par id : l'edge
-- function fait un upsert sur `lot_id`, donc un passage rejoue reecrit la meme
-- ligne et l'id n'est pas connu d'avance.
-- `photos_annonces` part avec (FK on delete cascade) ; le test n'en televerse
-- aucune, mais un ajout manuel pendant la verification serait donc emporte.
delete from public.annonces_marketplace
 where lot_id = '04942aad-029e-4ad3-b2ec-21945cd4898a';

-- ── 2. Les coordonnees ecrites sur le lot ───────────────────────────────────
-- `publier-annonce` ecrit latitude/longitude sur le lot des qu'un point est
-- pose sur la carte (index.ts:95-101). Les deux etaient nulles.
update public.lots
   set latitude = null,
       longitude = null
 where id = '04942aad-029e-4ad3-b2ec-21945cd4898a';

-- ── 3. Les DEUX remises physiques simulees par la fixture ───────────────────
-- La seconde (ATT-CESS-2026-00849, N'CHO OHOUO BONIFACE) n'existe que pour que
-- le refus du lot d'autrui ait un motif unique ; elle n'est jamais publiee,
-- mais elle doit revenir a `generee` comme la premiere.
update public.attestations_cession
   set statut      = 'generee',
       delivree_le = null
 where id in ('dbf0f5c7-e863-467d-928f-78a862c80d30',
              'ec5be05c-a5a2-41c0-a0ee-809dc5ee5a0d');

-- ── 4. Le garde-fou anti-spam des suiveurs ──────────────────────────────────
-- Sans effet tant que le test s'arrete au brouillon (le declencheur
-- `trg_notif_annonce_active_suivis` ne part qu'en statut 'active'). Pose ici
-- parce que la seule facon de decouvrir qu'il manquait serait qu'un suiveur
-- reel cesse d'etre prevenu — un defaut silencieux, et definitif pour lui.
update public.suivis_parcelle
   set notifie_le = null
 where lot_id = '04942aad-029e-4ad3-b2ec-21945cd4898a';

-- ── Controle final : tout doit etre revenu a l'etat de reference ────────────
-- Les DEUX attestations sont controlees, pas seulement celle qui a servi a la
-- publication : la fixture en promeut deux, une restauration qui n'en verifie
-- qu'une laisserait la seconde `delivree` sans que rien ne le signale — et un
-- lot faussement eligible est exactement ce que ce script existe pour eviter.
--
-- Attendu, pour les deux lignes :
--   statut = 'generee', delivree_le = null, latitude = null, longitude = null,
--   annonces = 0, suivis_notifies = 0.
select ac.reference,
       ac.statut,
       ac.delivree_le,
       l.numero_lot,
       l.latitude,
       l.longitude,
       (select count(*) from public.annonces_marketplace am where am.lot_id = l.id) as annonces,
       (select count(*) from public.suivis_parcelle sp
         where sp.lot_id = l.id and sp.notifie_le is not null)                      as suivis_notifies
  from public.attestations_cession ac
  join public.lots l on l.id = ac.lot_id
 where ac.id in ('dbf0f5c7-e863-467d-928f-78a862c80d30',
                 'ec5be05c-a5a2-41c0-a0ee-809dc5ee5a0d')
 order by ac.reference;
