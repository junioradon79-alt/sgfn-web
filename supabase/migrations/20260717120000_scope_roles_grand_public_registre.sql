-- Ferme la lecture du registre national aux rôles « grand public ».
--
-- Contexte : un `proprietaire_terrien` lisait via l'API **1351 attributions,
-- 898 lots et 53 attributaires** — soit tout le registre national, nommément
-- (qui possède quoi, dans quel lotissement). Le menu resserré masque
-- /dashboard/lots, mais l'API, non. Mesuré en SQL par impersonation
-- (`set local role authenticated` + `request.jwt.claims`).
--
-- Cause : trois policies héritées du début du projet neutralisaient tout le
-- travail de scoping fait à côté — les policies RLS se combinent en OU, donc une
-- seule policy `true` suffit à tout rouvrir :
--   • lots          → « Autoriser la lecture des lots pour les utilisateurs connectés » = true
--   • attributaires → « Autoriser la lecture des attributaires pour les connectés »     = true
--   • attributions  → `attributions_read` listait les rôles publics dans un `any` national
--
-- Enjeu : ce rôle passe de 2 comptes d'initiés à une population de propriétaires
-- **concurrents du même lotissement** (23 personnes physiques détiennent 447 lots,
-- 5 seulement ont un compte). Idem `acquereur`, dont le volume va croître avec le
-- captage de leads par QR.
--
-- ── Périmètre volontairement chirurgical ─────────────────────────────────────
-- On ferme les 3 rôles grand public : proprietaire_terrien, proprietaire, acquereur.
-- Les rôles métier (operateur, operateur_saisie, amenageur, geometre, agent_ia,
-- verificateur, commissaire, chefferie) gardent **exactement** leur accès actuel,
-- mais écrit explicitement plutôt que par un `true` anonyme.
--
-- ⚠️ Dette assumée, PAS traitée ici : ces rôles métier n'ont aucun rattachement en
-- base (0 profil `operateur` avec `operateur_id`, aucun aménageur rattaché), donc
-- leurs branches scopées dans `lots_read_scope` sont mortes — les scoper suppose
-- d'abord un travail de données. Chantier distinct.

-- ── Helper : les lots que je détiens (perso + collectif de ma famille) ────────
-- SECURITY DEFINER : indispensable, la fonction lit `attributions` alors qu'elle
-- est utilisée dans une policy SUR `attributions` (sinon récursion RLS).
create or replace function public.mes_lot_ids()
  returns setof uuid language sql stable security definer set search_path to 'public'
as $$
  select a.lot_id
  from attributions a
  where a.actuel
    and a.attributaire_id in (mon_attributaire_id(), ma_famille_attributaire_id());
$$;

comment on function public.mes_lot_ids() is
  'Lots actuellement détenus par l''utilisateur (son attributaire + le collectif de sa famille). Utilisé par les policies RLS des rôles grand public.';

-- ── lots ─────────────────────────────────────────────────────────────────────
-- Le `true` pour tout compte connecté devient une liste explicite de rôles métier.
-- Les rôles grand public retombent sur `lots_read_scope` (leurs lots) et
-- `lots_marketplace_public_read` (les annonces actives) — inchangées.
-- chefferie retombe sur sa branche « juridiction » de `lots_read_scope` : même
-- résultat qu'aujourd'hui, mais scopé pour de bon.
drop policy if exists "Autoriser la lecture des lots pour les utilisateurs connectés" on public.lots;

create policy lots_read_metier on public.lots
  for select to authenticated
  using (
    mon_groupe() = any (array[
      'operateur'::groupe_utilisateur,
      'operateur_saisie'::groupe_utilisateur,
      'amenageur'::groupe_utilisateur,
      'geometre'::groupe_utilisateur,
      'agent_ia'::groupe_utilisateur,
      'verificateur'::groupe_utilisateur,
      'commissaire'::groupe_utilisateur
    ])
  );

-- ── attributaires ────────────────────────────────────────────────────────────
-- Idem : liste explicite pour les rôles métier (chefferie incluse = statu quo).
-- Les rôles grand public gardent leur propre fiche (`attrib_self_read`) + celles
-- des attributaires présents sur LEURS lots, pour que la chaîne de propriété du
-- dossier foncier (LotDetailModal) reste lisible sur leurs propres parcelles.
drop policy if exists "Autoriser la lecture des attributaires pour les connectés" on public.attributaires;

create policy attributaires_read_metier on public.attributaires
  for select to authenticated
  using (
    mon_groupe() = any (array[
      'operateur'::groupe_utilisateur,
      'operateur_saisie'::groupe_utilisateur,
      'amenageur'::groupe_utilisateur,
      'geometre'::groupe_utilisateur,
      'agent_ia'::groupe_utilisateur,
      'chefferie'::groupe_utilisateur
    ])
  );

create policy attributaires_read_sur_mes_lots on public.attributaires
  for select to authenticated
  using (
    exists (
      select 1 from attributions a
      where a.attributaire_id = attributaires.id
        and a.lot_id in (select public.mes_lot_ids())
    )
  );

-- ── attributions ─────────────────────────────────────────────────────────────
-- Retire proprietaire_terrien / proprietaire du `any` national et leur donne à la
-- place les attributions de LEURS lots (chaîne de propriété complète, y compris
-- les rangs antérieurs — c'est leur propre parcelle). `acquereur` n'était pas dans
-- le `any` : il gagne la même chose, ce qui corrige au passage un manque (il ne
-- voyait que sa propre ligne, pas l'historique du lot qu'il a acheté).
drop policy if exists attributions_read on public.attributions;

create policy attributions_read on public.attributions
  for select
  using (
    est_admin()
    or attributaire_id = mon_attributaire_id()
    or mon_groupe() = any (array[
      'chefferie'::groupe_utilisateur,
      'operateur'::groupe_utilisateur,
      'operateur_saisie'::groupe_utilisateur,
      'verificateur'::groupe_utilisateur,
      'commissaire'::groupe_utilisateur
    ])
    or (
      mon_groupe() = any (array[
        'proprietaire_terrien'::groupe_utilisateur,
        'proprietaire'::groupe_utilisateur,
        'acquereur'::groupe_utilisateur
      ])
      and lot_id in (select public.mes_lot_ids())
    )
  );
