-- Ouvre la lecture/mise à jour de la table `demarches` (bornage, etc.) à
-- l'agent assigné (ex. un géomètre-expert) — jusqu'ici seuls l'admin et
-- l'attributaire concerné pouvaient lire une démarche, ce qui rendait la
-- table invisible à quiconque était réellement chargé de l'exécuter.
--
-- Restreint à `type = 'bornage'` pour ce premier usage (espace dédié
-- géomètre) ; les autres types de démarches restent réservés à l'admin et
-- à l'attributaire, comme avant.

create policy demarches_geometre_read on public.demarches for select
  using (type = 'bornage' and agent_assigne = (select auth.uid()));

create policy demarches_geometre_update on public.demarches for update
  using (type = 'bornage' and agent_assigne = (select auth.uid()))
  with check (type = 'bornage' and agent_assigne = (select auth.uid()));
