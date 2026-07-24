-- Audit Advisors Supabase du 24/07 (revue des warnings sécurité) : 4 vues du
-- chantier Niveaux 1/2/3 (22-23/07) créées sans `security_invoker = true`.
--
-- Conséquence réelle : ces vues s'exécutent avec les droits de leur
-- propriétaire (postgres, qui contourne RLS) au lieu de ceux de l'appelant.
-- Combiné au privilège par défaut du schéma public (SELECT accordé à `anon`
-- sur toute nouvelle relation créée par postgres), un utilisateur anonyme
-- pouvait lire lot_id/attributaire_id/titulaire_registre (nom réel) via
-- l'API REST directe — alors qu'aucune migration n'a jamais accordé SELECT
-- à anon (seulement à authenticated). Même catégorie que la fuite
-- `lotissements` corrigée le matin même (20260724160000).
--
-- Remède déjà en usage ailleurs dans le projet (20260709/20260711) :
-- `security_invoker = true` fait exécuter la vue avec les droits ET les
-- policies RLS de l'appelant, pas du propriétaire.

alter view public.v_attestations_bloquees_documents set (security_invoker = true);
alter view public.v_attestations_gratuites_manquantes set (security_invoker = true);
alter view public.v_niveau2_eligibles_manuel set (security_invoker = true);
alter view public.v_niveau3_retroactif_eligibles set (security_invoker = true);
