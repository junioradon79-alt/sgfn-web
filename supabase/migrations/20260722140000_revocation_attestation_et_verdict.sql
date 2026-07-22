-- Révocation d'une attestation de cession + verdict calculé côté serveur
-- (22/07/2026)
--
-- Deux défauts corrigés ensemble, parce que corriger l'un sans l'autre ne
-- servirait à rien :
--
-- 1. Le statut `revoquee` existait dans l'enum et le front savait l'AFFICHER,
--    mais aucun chemin ne le POSAIT : le seul `update statut='revoquee'` du
--    dépôt concerne les invitations. Une attestation erronée ou frauduleuse ne
--    pouvait être révoquée qu'en SQL manuel.
--
-- 2. Même révoquée, elle serait restée indiscernable d'une attestation valide
--    pour le public : `verifier_attestation()` renvoyait `statut_attestation`
--    brut, sans en tirer de verdict, et la page /verifier se contentait de
--    l'imprimer comme valeur de champ — le mot « revoquee » en petit dans une
--    ligne de tableau, tout le reste présenté normalement. Pour un système dont
--    la promesse est la vérifiabilité, c'est le trou le plus grave.
--
-- Le motif de révocation est enregistré mais N'EST PAS exposé publiquement :
-- il peut nommer une fraude ou une personne, et le public n'a besoin de savoir
-- que deux choses — le document ne vaut rien, et depuis quand.

-- ── 1. Traçabilité de la révocation ──────────────────────────────────────────

alter table public.attestations_cession
  add column if not exists revoquee_le  timestamptz,
  add column if not exists revoquee_par uuid references public.profiles(id),
  add column if not exists motif_revocation text;

comment on column public.attestations_cession.motif_revocation is
  'Motif interne de la révocation. Jamais exposé par verifier_attestation() : '
  'il peut nommer une fraude ou une personne.';

-- ── 2. RPC de révocation ─────────────────────────────────────────────────────
--
-- Réservée à l'admin. Aucune RPC inverse n'est fournie : une révocation est un
-- acte qui engage, et la « dé-révoquer » silencieusement retirerait toute
-- valeur au registre. Une correction passe par une nouvelle attestation.

create or replace function public.revoquer_attestation(p_id uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_statut statut_att_cession;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if nullif(btrim(coalesce(p_motif, '')), '') is null or length(btrim(p_motif)) < 10 then
    raise exception 'Un motif de revocation d''au moins 10 caracteres est requis.';
  end if;

  select statut into v_statut from attestations_cession where id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  if v_statut = 'revoquee' then
    raise exception 'Cette attestation est deja revoquee.';
  end if;

  -- Une attestation encore `a_generer` n'a jamais circulé : il n'y a rien à
  -- révoquer, seulement une ligne à corriger en amont.
  if v_statut not in ('generee', 'delivree') then
    raise exception 'Seule une attestation generee ou delivree peut etre revoquee (statut actuel : %).', v_statut;
  end if;

  update attestations_cession
  set statut           = 'revoquee',
      revoquee_le      = now(),
      revoquee_par     = auth.uid(),
      motif_revocation = btrim(p_motif)
  where id = p_id;
end;
$function$;

revoke all on function public.revoquer_attestation(uuid, text) from public;
grant execute on function public.revoquer_attestation(uuid, text) to authenticated;

-- ── 3. Verdict calculé côté serveur ──────────────────────────────────────────
--
-- Le verdict est calculé ici et non dans le front : c'est la garantie qu'un
-- client modifié ne peut pas afficher « valide » sur un document révoqué.
-- Corps identique à la version précédente, hors les quatre clés ajoutées à la
-- fin de l'objet.

create or replace function public.verifier_attestation(p_ref text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with a as (select * from attestations_cession where reference = p_ref or qr_token = p_ref),
  lot as (select l.* from lots l join a on a.lot_id = l.id)
  select jsonb_build_object(
    'reference', (select reference from a),
    'statut_attestation', (select statut from a),
    'gratuite', (select cession_id is null from a),
    'proprietaire_actuel', (
      select att.nom from attributions x
      join attributaires att on att.id = x.attributaire_id
      where x.lot_id = (select id from lot) and x.actuel order by x.rang limit 1),
    'qualite_proprietaire_actuel', (
      select x.qualite from attributions x where x.lot_id = (select id from lot) and x.actuel order by x.rang limit 1),
    'historique_propriete', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nom', att.nom, 'qualite', x.qualite, 'depuis', x.depuis, 'actuel', x.actuel) order by x.depuis), '[]'::jsonb)
      from attributions x join attributaires att on att.id = x.attributaire_id where x.lot_id = (select id from lot)),
    'statut_acquereur', (select c.statut::text from cessions c where c.id = (select cession_id from a)),
    'autorite_coutumiere_apfc', (
      select ac.nom from attestations_cession a2
      join attestations_coutumieres apfc on apfc.id = a2.apfc_id
      join autorites_coutumieres ac on ac.id = apfc.autorite_coutumiere_id
      where a2.reference = p_ref or a2.qr_token = p_ref),
    'statut_litige', (
      select coalesce((select statut::text from litiges where lot_id=(select id from lot) and statut<>'clos' limit 1),'aucun')),
    'guide_reference', (
      select lt.guide_reference from lotissements lt
      join ilots il on il.lotissement_id = lt.id
      where il.id = (select ilot_id from lot)),
    'guide_page', (select guide_page from lot),
    'pv_identification_physique_numero', (
      select lt.pv_identification_physique_numero from lotissements lt
      join ilots il on il.lotissement_id = lt.id
      where il.id = (select ilot_id from lot)),
    'score_confiance', public.score_confiance_lot((select id from lot)),

    -- Verdict d'authenticité, calculé serveur.
    'verdict', (
      select case a.statut
        when 'revoquee' then 'revoquee'
        when 'a_generer' then 'non_emise'
        else 'valide'
      end from a),
    'verdict_libelle', (
      select case a.statut
        when 'revoquee' then 'Document révoqué — ne pas s''y fier'
        when 'a_generer' then 'Document pas encore émis'
        when 'generee'  then 'Document authentique — remise en cours'
        when 'delivree' then 'Document authentique et remis'
      end from a),
    -- Libellé lisible : le public voyait jusqu'ici la valeur brute de l'enum
    -- (« a_generer », « delivree »).
    'statut_attestation_libelle', (
      select case a.statut
        when 'a_generer' then 'À générer'
        when 'generee'   then 'Générée'
        when 'delivree'  then 'Délivrée'
        when 'revoquee'  then 'Révoquée'
      end from a),
    -- Date seule : le motif reste interne.
    'revoquee_le', (select revoquee_le from a)
  );
$function$;
