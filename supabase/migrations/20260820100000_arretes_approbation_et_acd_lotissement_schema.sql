-- ============================================================================
--  Pièces foncières principales des lotissements "approuvé" et "ACD" (Phase B,
--  20/08/2026) — suite de la Phase A (migration 20260818120000_type_lotissement,
--  EN PROD depuis le 18/08).
--
--  Décision du propriétaire, tranchée et NON rouverte ici : 3 TABLES SÉPARÉES
--  par type de lotissement, pas une table générique.
--    - villageois -> attestations_coutumieres (APFC)   -- existe déjà, INTACTE
--    - approuvé   -> arretes_approbation_lotissement    -- créée ici
--    - acd        -> arretes_acd_lotissement            -- créée ici
--
--  ── CE QUI A ÉTÉ VÉRIFIÉ EN LECTURE SEULE AVANT D'ÉCRIRE (20/08) ───────────
--   * `attestations_coutumieres` (17 colonnes) porte 3×2 colonnes de signature
--     (sig_chef_village_*, sig_cvgfr_*, sig_chef_famille_*), `chef_de_famille`,
--     `non_contestation`, `cvgfr_id`, `famille_id` — toutes propres à l'APFC
--     coutumière, sans équivalent pour un arrêté administratif. Gabarit de
--     forme, pas de contenu : on ne les recopie pas.
--   * `autorites_coutumieres.numero_arrete_nomination/date_arrete/
--     autorite_signataire/arrete_nomination_scan_url` (migration
--     20260724100000) est le bon gabarit : un arrêté administratif se décrit
--     par un numéro, une date, un signataire, un scan — rien de plus.
--   * NI `attestations_coutumieres` NI `autorites_coutumieres` ne portent de
--     colonne `cree_le`/`modifie_le` : ces deux tables de référence citées
--     comme gabarit n'ont AUCUN horodatage. La convention `cree_le`/
--     `modifie_le` (+ trigger de mise à jour) EST cependant établie ailleurs
--     dans ce dépôt sur des tables comparables plus récentes
--     (`collaborateurs` — 20260724181000, `chefs_autorites_coutumieres` —
--     20260729100000). Choix fait ici, documenté plutôt que deviné en
--     silence : ON AJOUTE `cree_le`/`modifie_le`, parce que ces deux pièces
--     seront éditées dans la durée (statut qui évolue de `a_delivrer` à
--     `delivree`, scan ajouté plus tard) et qu'une traçabilité minimale de
--     "quand" a plus de valeur ici que la fidélité stricte aux deux tables
--     sans historique prises comme référence de FORME.
--   * Exactement 0 ligne dans `information_schema.tables` pour `arretes_%` —
--     aucune des deux tables n'existe déjà.
--   * `lotissements.type_lotissement` confirmé : Koelea-Accor revu = villageois,
--     Brignan Kakodji = approuve (aucun 3e lotissement, aucun cas 'acd' réel).
--
--  ── CE QUE CETTE MIGRATION NE FAIT PAS ──────────────────────────────────
--  Aucun backfill pour Brignan Kakodji : l'arrêté d'approbation n'est pas
--  encore disponible (numéro/scan à obtenir séparément, propriétaire du
--  projet). Les deux tables restent VIDES après cette migration — c'est
--  l'état attendu, pas un oubli.
--
--  Cette migration doit être appliquée AVANT (ou avec) la migration suivante
--  (20260820110000_generaliser_score_confiance_type_lotissement.sql), qui lit
--  ces deux tables depuis `calculer_score_confiance()`. Les deux peuvent être
--  appliquées dans la même transaction/session sans problème d'ordre puisque
--  supabase-sql.ps1 exécute chaque fichier en une seule requête ; si elles
--  sont appliquées séparément, l'ordre par nom de fichier (100000 avant
--  110000) suffit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum de statut -- mêmes valeurs que statut_apfc, nom propre : ces pièces
--    ne sont pas des APFC, le nom ne doit pas le laisser croire.
-- ---------------------------------------------------------------------------

create type public.statut_piece_administrative as enum ('a_delivrer', 'en_cours', 'delivree');

comment on type public.statut_piece_administrative is
  'Statut d''une pièce foncière administrative (arrêté d''approbation ou arrêté ACD) : mêmes valeurs que statut_apfc (a_delivrer/en_cours/delivree), nom distinct pour ne pas laisser un nom "apfc" sur une pièce qui n''en est pas une.';

-- ---------------------------------------------------------------------------
-- 2. Arrêté d'approbation -- lotissements de type 'approuve' (ex. Brignan
--    Kakodji). Un seul arrêté par lotissement (contrainte unique).
-- ---------------------------------------------------------------------------

create table public.arretes_approbation_lotissement (
  id                  uuid primary key default gen_random_uuid(),
  lotissement_id      uuid not null unique references public.lotissements(id),
  numero              text,
  date_arrete         date,
  autorite_signataire text,
  statut              public.statut_piece_administrative not null default 'a_delivrer',
  date_delivrance     date,
  scan_url            text,
  cree_le             timestamptz not null default now(),
  modifie_le          timestamptz not null default now()
);

comment on table public.arretes_approbation_lotissement is
  'Arrêté d''approbation -- pièce foncière principale des lotissements de type "approuve" (ex. Brignan Kakodji), au même titre que attestations_coutumieres (APFC) pour les lotissements "villageois". Un seul arrêté par lotissement. Alimente calculer_score_confiance() au même barème que l''APFC (40/20/10/0 pts selon statut delivree/en_cours/a_delivrer/absent). Vide à la création (20/08/2026) : aucun arrêté de Brignan Kakodji n''est encore disponible, pas de backfill devinable.';

-- ---------------------------------------------------------------------------
-- 3. Arrêté ACD -- lotissements de type 'acd'. Structure identique à
--    l'arrêté d'approbation (même gabarit administratif), table séparée par
--    décision explicite du propriétaire (pas de généralisation).
-- ---------------------------------------------------------------------------

create table public.arretes_acd_lotissement (
  id                  uuid primary key default gen_random_uuid(),
  lotissement_id      uuid not null unique references public.lotissements(id),
  numero              text,
  date_arrete         date,
  autorite_signataire text,
  statut              public.statut_piece_administrative not null default 'a_delivrer',
  date_delivrance     date,
  scan_url            text,
  cree_le             timestamptz not null default now(),
  modifie_le          timestamptz not null default now()
);

comment on table public.arretes_acd_lotissement is
  'Arrêté ACD -- pièce foncière principale des lotissements de type "acd" (aucun réel en base au 20/08/2026). Même forme que arretes_approbation_lotissement, table séparée par décision explicite du propriétaire du projet. Alimente calculer_score_confiance() au même barème que l''APFC.';

-- ---------------------------------------------------------------------------
-- 4. Horodatage de modification -- une seule fonction de trigger réutilisée
--    par les deux tables (même patron que trg_maj_modifie_collaborateur,
--    20260724181000, mais partagée plutôt que dupliquée : les deux tables ont
--    rigoureusement la même colonne modifie_le à tenir à jour).
-- ---------------------------------------------------------------------------

create or replace function public.trg_maj_modifie_le()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

comment on function public.trg_maj_modifie_le() is
  'Trigger générique BEFORE UPDATE : fixe modifie_le à now(). Réutilisé par arretes_approbation_lotissement et arretes_acd_lotissement (colonne identique sur les deux tables).';

-- Fonction de trigger : jamais appelée hors contexte trigger (PostgreSQL le
-- refuse nativement), mais fermée à anon/public par cohérence avec la
-- posture du dépôt depuis 20260730010000 -- coût nul, geste systématique.
revoke all on function public.trg_maj_modifie_le() from public, anon;

create trigger arretes_approbation_maj_modifie
before update on public.arretes_approbation_lotissement
for each row execute function public.trg_maj_modifie_le();

create trigger arretes_acd_maj_modifie
before update on public.arretes_acd_lotissement
for each row execute function public.trg_maj_modifie_le();

-- ---------------------------------------------------------------------------
-- 5. RLS -- patron équivalent à apfc_admin_all / apfc_read
--    (attestations_coutumieres), adapté à l'ABSENCE de colonne
--    autorite_coutumiere_id/famille_id directe sur ces deux tables (l'arrêté
--    ne porte que lotissement_id ; le rattachement chefferie passe donc par
--    une jointure sur lotissements, alors qu'attestations_coutumieres le
--    porte en direct).
--
--    Choix explicite, documenté plutôt que deviné :
--    - admin  : ALL, comme apfc_admin_all.
--    - lecture élargie reconduite pour operateur/verificateur/geometre,
--      comme apfc_read (lecture nationale déjà en place pour ces rôles sur
--      l'APFC).
--    - chefferie : scopée à sa juridiction via lotissements.autorite_
--      coutumiere_id = ma_chefferie_id(), même principe que apfc_read mais
--      via jointure (apfc_read compare directement la colonne).
--    - proprietaire_terrien : PAS reconduit. apfc_read le scope par
--      famille_id (attestations_coutumieres.famille_id = ma_famille_id()) --
--      un arrêté d'approbation/ACD n'a aucune notion de famille, il n'existe
--      donc aucun équivalent à ce scope. Signalé ici plutôt que deviné : si
--      le propriétaire veut que ce rôle voie ces pièces, il faudra définir
--      SUR QUEL critère (aucun aujourd'hui).
--    - commissaire : PAS inclus, à l'identique de apfc_read qui ne l'inclut
--      pas non plus (vérifié en lecture seule le 20/08).
-- ---------------------------------------------------------------------------

alter table public.arretes_approbation_lotissement enable row level security;
alter table public.arretes_acd_lotissement enable row level security;

create policy arretes_approbation_admin_all on public.arretes_approbation_lotissement
  for all to public
  using (public.est_admin())
  with check (public.est_admin());

create policy arretes_approbation_read on public.arretes_approbation_lotissement
  for select to authenticated
  using (
    public.est_admin()
    or (
      public.mon_groupe() = 'chefferie'::groupe_utilisateur
      and exists (
        select 1 from lotissements lo
        where lo.id = arretes_approbation_lotissement.lotissement_id
          and lo.autorite_coutumiere_id = public.ma_chefferie_id()
      )
    )
    or public.mon_groupe() = any (array['operateur', 'verificateur', 'geometre']::groupe_utilisateur[])
  );

create policy arretes_acd_admin_all on public.arretes_acd_lotissement
  for all to public
  using (public.est_admin())
  with check (public.est_admin());

create policy arretes_acd_read on public.arretes_acd_lotissement
  for select to authenticated
  using (
    public.est_admin()
    or (
      public.mon_groupe() = 'chefferie'::groupe_utilisateur
      and exists (
        select 1 from lotissements lo
        where lo.id = arretes_acd_lotissement.lotissement_id
          and lo.autorite_coutumiere_id = public.ma_chefferie_id()
      )
    )
    or public.mon_groupe() = any (array['operateur', 'verificateur', 'geometre']::groupe_utilisateur[])
  );

-- ---------------------------------------------------------------------------
-- 6. Grants de table -- AUCUN grant explicite à anon n'est écrit : depuis
--    20260730010000 (default ACL), une table neuve NE NAÎT PLUS ouverte à
--    anon. `authenticated` reçoit le défaut de schéma habituel (RLS ci-dessus
--    est le filtre réel), exactement comme attestations_coutumieres.
--    TRUNCATE échappe cependant à la RLS (constat vérificateur du 20/08,
--    parité pré-existante avec attestations_coutumieres) : fermé ici sur les
--    2 tables neuves, sans attendre un chantier séparé.
-- ---------------------------------------------------------------------------

revoke truncate on table public.arretes_approbation_lotissement from authenticated;
revoke truncate on table public.arretes_acd_lotissement from authenticated;
