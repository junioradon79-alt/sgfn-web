-- Captage de leads : suivi de parcelle par un acquéreur.
--
-- Une personne qui scanne un QR de document sur /verifier peut créer un compte
-- acquéreur pour « être prévenue si ce terrain est mis en vente » (ou, s'il est
-- déjà en vente, pour contacter le vendeur). Ce fichier pose la fondation
-- données : la table de suivi + les 3 RPC qui la pilotent, toutes SECURITY
-- DEFINER pour ne jamais exposer le registre national (cf. scoping du 17/07,
-- 20260717120000_scope_roles_grand_public_registre.sql).

-- ── Table ─────────────────────────────────────────────────────────────────────
create table if not exists public.suivis_parcelle (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  lot_id             uuid not null references public.lots(id) on delete cascade,
  source             text not null default 'qr' check (source in ('qr','annonce','manuel')),
  reference_document text,
  notifie_le         timestamptz,           -- date d'envoi de l'alerte « mis en vente »
  cree_le            timestamptz not null default now(),
  unique (profile_id, lot_id)
);

create index if not exists idx_suivis_parcelle_profile on public.suivis_parcelle(profile_id);
create index if not exists idx_suivis_parcelle_lot on public.suivis_parcelle(lot_id);

alter table public.suivis_parcelle enable row level security;

-- L'acquéreur ne voit / ne gère que ses propres suivis ; l'admin voit tout (leads).
drop policy if exists suivis_self_select on public.suivis_parcelle;
create policy suivis_self_select on public.suivis_parcelle
  for select using (profile_id = (select auth.uid()) or est_admin());

drop policy if exists suivis_self_insert on public.suivis_parcelle;
create policy suivis_self_insert on public.suivis_parcelle
  for insert with check (profile_id = (select auth.uid()));

drop policy if exists suivis_self_delete on public.suivis_parcelle;
create policy suivis_self_delete on public.suivis_parcelle
  for delete using (profile_id = (select auth.uid()));

-- ── Résolveur reference → lot ─────────────────────────────────────────────────
-- La référence est celle affichée gratuitement par /verifier (aperçu). On la
-- résout côté serveur pour ne jamais exposer lot_id au client anonyme.
create or replace function public.lot_pour_reference(p_reference text)
  returns uuid language sql stable security definer set search_path to 'public'
as $$
  select lot_id from (
    select lot_id from attestations_cession where reference = p_reference
    union all
    select lot_id from certificats_vente where reference = p_reference
  ) t
  limit 1;
$$;

-- ── suivre_parcelle : l'acquéreur connecté suit la parcelle scannée ───────────
create or replace function public.suivre_parcelle(p_reference text)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lot uuid;
  v_insere boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'raison', 'non_connecte');
  end if;
  v_lot := lot_pour_reference(p_reference);
  if v_lot is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  insert into suivis_parcelle (profile_id, lot_id, source, reference_document)
  values (v_uid, v_lot, 'qr', p_reference)
  on conflict (profile_id, lot_id) do nothing;

  v_insere := found;
  return jsonb_build_object('ok', true, 'deja_suivi', not v_insere);
end;
$$;

-- ── annonce_active_pour_reference : l'aimant de l'invite (appelable anon) ──────
-- Ne renvoie QUE le statut de vente + l'id d'annonce — jamais de donnée de
-- registre. Sert à choisir l'aimant (« en vente » vs « être prévenu »).
create or replace function public.annonce_active_pour_reference(p_reference text)
  returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_lot uuid := lot_pour_reference(p_reference);
  v_annonce uuid;
begin
  if v_lot is null then
    return jsonb_build_object('en_vente', false, 'annonce_id', null);
  end if;
  select id into v_annonce
  from annonces_marketplace
  where lot_id = v_lot and statut = 'active'
  limit 1;
  return jsonb_build_object('en_vente', v_annonce is not null, 'annonce_id', v_annonce);
end;
$$;

-- ── mes_suivis : alimente le dashboard acquéreur ──────────────────────────────
create or replace function public.mes_suivis()
  returns table (
    lot_id       uuid,
    numero_lot   text,
    ilot_numero  text,
    lotissement  text,
    en_vente     boolean,
    annonce_id   uuid,
    cree_le      timestamptz
  )
  language sql stable security definer set search_path to 'public'
as $$
  select
    s.lot_id,
    l.numero_lot,
    i.numero,
    lo.nom,
    a.id is not null,
    a.id,
    s.cree_le
  from suivis_parcelle s
  join lots l on l.id = s.lot_id
  left join ilots i on i.id = l.ilot_id
  left join lotissements lo on lo.id = i.lotissement_id
  left join annonces_marketplace a on a.lot_id = s.lot_id and a.statut = 'active'
  where s.profile_id = (select auth.uid())
  order by s.cree_le desc;
$$;

-- ── Droits d'exécution ────────────────────────────────────────────────────────
-- ⚠️ Supabase accorde EXECUTE à anon/authenticated DIRECTEMENT (default privileges
-- du schéma public), pas seulement via PUBLIC → pour fermer anon il faut le
-- révoquer explicitement, `revoke ... from public` ne suffit pas.
revoke all on function public.lot_pour_reference(text) from public, anon, authenticated;

revoke execute on function public.suivre_parcelle(text) from public, anon;
grant execute on function public.suivre_parcelle(text) to authenticated;

revoke execute on function public.mes_suivis() from public, anon;
grant execute on function public.mes_suivis() to authenticated;

-- L'aimant de l'invite doit répondre AVANT connexion → anon autorisé, mais il ne
-- renvoie que { en_vente, annonce_id }, jamais de donnée de registre.
grant execute on function public.annonce_active_pour_reference(text) to anon, authenticated;
