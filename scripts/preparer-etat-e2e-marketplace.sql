-- Fixture du parcours VENDEUR de la place de marche.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\preparer-etat-e2e-marketplace.sql
--   node scripts/e2e-marketplace-vendeur.mjs --ecriture
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\restaurer-etat-e2e-marketplace.sql
--
-- POURQUOI une fixture est necessaire : l'ecran « Mettre en vente » n'ouvre
-- son formulaire que pour un lot dont l'attestation ou le certificat est au
-- statut `delivree`. Au 28/07/2026 la base n'en compte AUCUN — 49 attestations
-- sont `generee` et 2 `revoquee`. Le parcours vendeur est donc integralement
-- injoignable tant que personne n'a confirme une remise physique. Ce n'est pas
-- un defaut : c'est la regle metier posee le 13/07 (marquer_attestation_delivree).
--
-- CE QUE CE SCRIPT TOUCHE, et rien d'autre — DEUX attestations :
--   ATT-CESS-2026-00848 (dbf0f5c7-…) lot 03 (04942aad-…) AKE AMAFIN NICODEME
--   ATT-CESS-2026-00849 (ec5be05c-…) lot 04 (41a2bf6f-…) N'CHO OHOUO BONIFACE
--
-- POURQUOI DEUX, alors qu'une seule suffirait a ouvrir le formulaire : le test
-- controle aussi que `publier-annonce` refuse le lot d'un TIERS. Avec un seul
-- lot delivre, ce refus s'expliquerait par l'absence de document et non par
-- l'appartenance — un vert qui ne prouve rien. Les deux lots delivres, chacun
-- a un attributaire different, le refus n'a plus qu'un seul motif possible.
--
-- Les deux lots sont choisis parce qu'ils n'ont AUCUN suiveur
-- (`suivis_parcelle`) : une publication ne peut donc prevenir personne par
-- erreur.
--
-- Etat de reference releve le 28/07/2026 avant le premier passage, identique
-- pour les deux : statut = 'generee', delivree_le = null, latitude = null,
-- longitude = null, 0 annonce, 0 suivi.
--
-- 🔴 La transition laisse une trace dans `journal_audit` via trg_audit_attcess.
--    Cette trace est un journal : elle n'est pas defaite par la restauration,
--    et c'est voulu.

update public.attestations_cession
   set statut      = 'delivree',
       delivree_le = now()
 where id in ('dbf0f5c7-e863-467d-928f-78a862c80d30',
              'ec5be05c-a5a2-41c0-a0ee-809dc5ee5a0d')
   and statut = 'generee';

-- Controle : doit renvoyer DEUX lignes `delivree`, sans annonce ni suiveur.
select ac.reference, ac.statut, ac.delivree_le,
       (select count(*) from public.annonces_marketplace am where am.lot_id = ac.lot_id) as annonces,
       (select count(*) from public.suivis_parcelle sp where sp.lot_id = ac.lot_id)      as suivis
  from public.attestations_cession ac
 where ac.id in ('dbf0f5c7-e863-467d-928f-78a862c80d30',
                 'ec5be05c-a5a2-41c0-a0ee-809dc5ee5a0d')
 order by ac.reference;
