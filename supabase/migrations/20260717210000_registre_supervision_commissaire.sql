-- Espace Commissaire — registre de supervision servi par une RPC SCOPÉE.
--
-- Problème 1 (perf) : la page commissaire chargeait le registre via un SELECT
-- PostgREST profondément imbriqué (lots → attributions → attributaires, +
-- attestations, + ilots/lotissements). La requête LATERAL générée, avec la RLS
-- ré-appliquée à chaque table embarquée, dépasse le statement_timeout du rôle
-- `authenticated` → HTTP 500 (57014), avalé en silence (« 0 lot » permanent).
--
-- Problème 2 (périmètre / sécurité) : un commissaire de justice ne doit voir QUE
-- les lotissements dont il a légalisé les PV — pas le registre national. Le
-- rattachement est porté par `lotissements.pv_commissaire_justice_id`, comparé à
-- l'étude du compte (`profiles.commissaire_id` via mon_commissaire_id()).
--
-- Correctif idiomatique (cf. suiveurs_de_mes_lots, mes_suivis) : une RPC
-- SECURITY DEFINER, rapide (contexte propriétaire, pas de RLS dans le plan) ET
-- explicitement scopée dans son WHERE. admin / vérificateur gardent une vue
-- nationale (supervision de l'État) ; le commissaire est borné à ses lotissements.
--
-- NB : la RLS de `lots` / `attestations_cession` reste à resserrer pour le
-- commissaire sur les autres pages (Lots, Attributaires…) — traité séparément.

create or replace function public.registre_supervision()
  returns table (
    lot_id                uuid,
    numero_lot            text,
    ilot_numero           text,
    lotissement_nom       text,
    statut                text,
    verrouille            boolean,
    attributaire_nom      text,
    qualite               text,
    attestation_reference text,
    attestation_statut    text,
    attestation_delivree  boolean,
    attestation_gratuite  boolean,
    pv_alerte_statut      text
  )
  language plpgsql stable security definer set search_path to 'public'
as $$
-- Les colonnes de sortie (lot_id, statut, numero_lot…) masquent les colonnes de
-- même nom dans les CTE : on demande à PL/pgSQL de résoudre vers la COLONNE.
#variable_conflict use_column
begin
  if not (est_admin() or mon_groupe() in ('commissaire', 'verificateur')) then
    raise exception 'Réservé à la supervision (commissaire, vérificateur, admin).'
      using errcode = '42501';
  end if;

  return query
  with
  -- Détenteur actuel du lot (un seul par lot ; à défaut, le rang le plus élevé).
  aa as (
    select distinct on (a.lot_id)
           a.lot_id, a.qualite::text as qualite, att.nom as nom
    from attributions a
    join attributaires att on att.id = a.attributaire_id
    where a.actuel
    order by a.lot_id, a.rang desc nulls last
  ),
  -- Attribution de rang 1 (origine) — sert à détecter une transmission depuis un
  -- collectif d'ayants-droit qui exigerait un PV de réunion de famille.
  r1 as (
    select distinct on (a.lot_id)
           a.lot_id, att.id as collectif_id, att.type::text as type
    from attributions a
    join attributaires att on att.id = a.attributaire_id
    where a.rang = 1
    order by a.lot_id
  ),
  -- Lots ayant au moins une transmission (rang > 1).
  tr as (
    select distinct a.lot_id from attributions a where a.rang > 1
  ),
  -- Collectifs disposant d'un PV validé (→ pas d'alerte).
  pv_ok as (
    select distinct p.collectif_attributaire_id as cid
    from pv_reunions_famille p
    where p.statut::text = 'valide'
  ),
  -- Dernier statut de PV connu par collectif (pour l'étiquette d'alerte).
  pv_last as (
    select distinct on (p.collectif_attributaire_id)
           p.collectif_attributaire_id as cid, p.statut::text as statut
    from pv_reunions_famille p
    order by p.collectif_attributaire_id, p.date_reunion desc nulls last
  ),
  -- Une attestation par lot, en préférant une attestation « délivrée ».
  att as (
    select distinct on (ac.lot_id)
           ac.lot_id, ac.reference, ac.statut::text as statut, ac.cession_id
    from attestations_cession ac
    order by ac.lot_id, (ac.statut::text = 'delivree') desc
  )
  select
    l.id,
    l.numero_lot,
    i.numero,
    lo.nom,
    l.statut::text,
    l.verrouille,
    aa.nom,
    aa.qualite,
    att.reference,
    att.statut,
    (att.statut = 'delivree'),
    (att.reference is not null and att.cession_id is null),
    case
      when r1.type = 'collectif_ayants_droit'
       and tr.lot_id is not null
       and pv_ok.cid is null
      then coalesce(pv_last.statut, 'a_fournir')
      else null
    end
  from lots l
  left join ilots i        on i.id = l.ilot_id
  left join lotissements lo on lo.id = i.lotissement_id
  left join aa             on aa.lot_id = l.id
  left join r1             on r1.lot_id = l.id
  left join tr             on tr.lot_id = l.id
  left join pv_ok          on pv_ok.cid = r1.collectif_id
  left join pv_last        on pv_last.cid = r1.collectif_id
  left join att            on att.lot_id = l.id
  -- Périmètre : national pour admin/vérificateur ; borné à ses lotissements pour
  -- le commissaire de justice (ceux dont il a légalisé les PV).
  where est_admin()
     or mon_groupe() = 'verificateur'
     or (mon_groupe() = 'commissaire' and lo.pv_commissaire_justice_id = mon_commissaire_id())
  order by l.numero_lot;
end;
$$;

revoke execute on function public.registre_supervision() from public, anon;
grant execute on function public.registre_supervision() to authenticated;
