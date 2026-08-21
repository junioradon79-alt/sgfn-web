-- Le Centre de pilotage affiche la carte "Activité" en temps réel : elle
-- s'abonne désormais aux INSERT de journal_audit au lieu d'attendre un clic
-- sur "Rafraîchir". La publication supabase_realtime est vide à ce jour
-- (puballtables=false, aucune table) ; journal_audit est la première qu'on y
-- ajoute. C'est sans risque côté confidentialité : postgres_changes respecte
-- le RLS par connexion, et journal_audit n'a qu'une policy SELECT
-- (audit_admin_read, condition est_admin()) — un abonné non-admin ne reçoit
-- donc rien de plus que ce que l'écran lui montre déjà.
alter publication supabase_realtime add table public.journal_audit;
