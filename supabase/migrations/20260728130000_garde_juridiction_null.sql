-- 🔴 Faille de garde : une chefferie SANS juridiction passait au travers.
--
-- Les trois fonctions de constat de signature testaient la juridiction ainsi :
--
--     if v_autorite is null or v_autorite <> public.ma_chefferie_id() then
--       raise exception 'Ce lotissement ne releve pas de votre juridiction.';
--     end if;
--
-- Quand `ma_chefferie_id()` vaut NULL — compte de groupe `chefferie` sans
-- `autorite_coutumiere_id` — l'expression `v_autorite <> NULL` s'évalue à NULL,
-- pas à TRUE. La condition complète vaut donc `FALSE OR NULL` = NULL, qui n'est
-- pas vrai : **l'exception n'est jamais levée et la signature est écrite**.
--
-- Prouvé en production le 28/07, sous la session réelle du compte chefferie non
-- rattaché (`0be830c7`), dans une transaction annulée :
--   refus="PAS DE REFUS" / sig_chefferie_le avant=NULL / APRES=2026-07-28 10:11:37
--
-- Autrement dit : un compte chefferie non rattaché pouvait constater la
-- signature de la chefferie sur **n'importe quelle** attestation du pays. La
-- RLS lui cache les identifiants, ce qui a jusqu'ici tenu lieu de barrière —
-- mais l'ignorance d'un UUID n'est pas un contrôle d'accès, et une des pistes
-- ouvertes (ouvrir la lecture à d'autres rôles) l'aurait levée.
--
-- ⚠️ Le défaut est **hérité** : `signer_attestation` le porte depuis le 22/07,
-- `signer_attestation_attribution_lot` l'a recopié le 23/07, et `signer_apfc`
-- l'a recopié le 28/07 — la copie d'un patron copie aussi ses trous. Les trois
-- sont corrigées ici, d'un même geste.
--
-- La correction rend le cas NULL explicite AVANT la comparaison, et lui donne
-- son propre message : « votre compte n'est rattaché à aucune chefferie » dit
-- quoi faire, là où « ce lotissement ne relève pas de votre juridiction »
-- enverrait chercher un problème de périmètre qui n'existe pas.

-- ── 1. Attestation de cession ────────────────────────────────────────────────

create or replace function public.signer_attestation(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe    groupe_utilisateur;
  v_statut    statut_att_cession;
  v_autorite  uuid;
  v_chefferie uuid;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id
    into v_statut, v_autorite
  from attestations_cession a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  if v_statut = 'revoquee' then
    raise exception 'Cette attestation est revoquee : elle ne peut plus etre signee.';
  end if;

  v_groupe := public.mon_groupe();

  if public.est_admin() or v_groupe = 'operateur' then
    null; -- constate les trois
  elsif v_groupe = 'chefferie' then
    if p_signature <> 'chefferie' then
      raise exception 'La chefferie ne peut constater que la signature de la chefferie.';
    end if;
    -- 🔴 Le NULL se teste AVANT la comparaison : `x <> NULL` vaut NULL, et une
    -- garde qui s'évalue à NULL ne lève rien.
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte n''est rattache a aucune chefferie : aucune signature ne peut etre constatee.';
    end if;
    if v_autorite is null or v_autorite <> v_chefferie then
      raise exception 'Ce lotissement ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration, a l''operateur et a la chefferie.';
  end if;

  -- Idempotent : re-constater ne réécrit pas l'horodatage d'origine.
  if p_signature = 'proprietaire' then
    update attestations_cession
    set sig_proprietaire_le = coalesce(sig_proprietaire_le, now()),
        sig_proprietaire_par = coalesce(sig_proprietaire_par, auth.uid())
    where id = p_id;
  elsif p_signature = 'operateur' then
    update attestations_cession
    set sig_operateur_le = coalesce(sig_operateur_le, now()),
        sig_operateur_par = coalesce(sig_operateur_par, auth.uid())
    where id = p_id;
  else
    update attestations_cession
    set sig_chefferie_le = coalesce(sig_chefferie_le, now()),
        sig_chefferie_par = coalesce(sig_chefferie_par, auth.uid())
    where id = p_id;
  end if;
end;
$function$;

-- ── 2. Attestation d'Attribution de Lot ──────────────────────────────────────

create or replace function public.signer_attestation_attribution_lot(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe    groupe_utilisateur;
  v_statut    statut_att_cession;
  v_autorite  uuid;
  v_paye      timestamptz;
  v_chefferie uuid;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id, a.signature_payee_le
    into v_statut, v_autorite, v_paye
  from attestations_attribution_lot a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation d''Attribution de Lot introuvable.';
  end if;

  if v_statut = 'revoquee' then
    raise exception 'Cette attestation est revoquee : elle ne peut plus etre signee.';
  end if;

  v_groupe := public.mon_groupe();

  if public.est_admin() or v_groupe = 'operateur' then
    null;
  elsif v_groupe = 'chefferie' then
    if p_signature <> 'chefferie' then
      raise exception 'La chefferie ne peut constater que la signature de la chefferie.';
    end if;
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte n''est rattache a aucune chefferie : aucune signature ne peut etre constatee.';
    end if;
    if v_autorite is null or v_autorite <> v_chefferie then
      raise exception 'Ce lotissement ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration, a l''operateur et a la chefferie.';
  end if;

  if p_signature = 'chefferie' and v_paye is null then
    raise exception 'Paiement de signature (500 000 FCFA chefferie + 50 000 FCFA commission SGNF) requis avant la signature Chefferie.';
  end if;

  if p_signature = 'proprietaire' then
    update attestations_attribution_lot
    set sig_proprietaire_le = coalesce(sig_proprietaire_le, now()),
        sig_proprietaire_par = coalesce(sig_proprietaire_par, auth.uid())
    where id = p_id;
  elsif p_signature = 'operateur' then
    update attestations_attribution_lot
    set sig_operateur_le = coalesce(sig_operateur_le, now()),
        sig_operateur_par = coalesce(sig_operateur_par, auth.uid())
    where id = p_id;
  else
    update attestations_attribution_lot
    set sig_chefferie_le = coalesce(sig_chefferie_le, now()),
        sig_chefferie_par = coalesce(sig_chefferie_par, auth.uid())
    where id = p_id;
  end if;
end;
$function$;

-- ── 3. APFC ──────────────────────────────────────────────────────────────────

create or replace function public.signer_apfc(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe    groupe_utilisateur;
  v_autorite  uuid;
  v_chefferie uuid;
begin
  if p_signature not in ('chef_famille', 'chef_village', 'cvgfr') then
    raise exception 'Signature inconnue : % (attendu chef_famille, chef_village ou cvgfr).', p_signature;
  end if;

  select a.autorite_coutumiere_id into v_autorite
  from attestations_coutumieres a
  where a.id = p_id;

  if not found then
    raise exception 'APFC introuvable.';
  end if;

  v_groupe := public.mon_groupe();

  if public.est_admin() then
    null; -- constate les trois
  elsif v_groupe = 'chefferie' then
    if p_signature <> 'chef_village' then
      raise exception 'La chefferie ne peut constater que la signature du chef de village.';
    end if;
    v_chefferie := public.ma_chefferie_id();
    if v_chefferie is null then
      raise exception 'Votre compte n''est rattache a aucune chefferie : aucune signature ne peut etre constatee.';
    end if;
    if v_autorite is null or v_autorite <> v_chefferie then
      raise exception 'Cette APFC ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration et a la chefferie.';
  end if;

  if p_signature = 'chef_famille' then
    update attestations_coutumieres
    set sig_chef_famille_le  = coalesce(sig_chef_famille_le, now()),
        sig_chef_famille_par = coalesce(sig_chef_famille_par, auth.uid())
    where id = p_id;
  elsif p_signature = 'chef_village' then
    update attestations_coutumieres
    set sig_chef_village_le  = coalesce(sig_chef_village_le, now()),
        sig_chef_village_par = coalesce(sig_chef_village_par, auth.uid())
    where id = p_id;
  else
    update attestations_coutumieres
    set sig_cvgfr_le  = coalesce(sig_cvgfr_le, now()),
        sig_cvgfr_par = coalesce(sig_cvgfr_par, auth.uid())
    where id = p_id;
  end if;
end;
$function$;
