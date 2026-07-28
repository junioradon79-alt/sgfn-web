-- L'opérateur : borner ses droits d'écriture, PUIS lui ouvrir la lecture.
--
-- 🔴 POURQUOI LES DEUX ENSEMBLE, ET JAMAIS L'UN SANS L'AUTRE.
--
-- État constaté en production le 28/07 :
--   • `signer_attestation`, `signer_attestation_attribution_lot`,
--     `marquer_attestation_delivree` et `marquer_..._attribution_lot_delivree`
--     autorisent le groupe `operateur` **sans aucun contrôle de périmètre** —
--     vérifié : `mon_operateur_id()` / `lot_ids_operateur()` n'apparaît dans
--     aucune des quatre. Un opérateur peut donc, en droit, constater les trois
--     signatures et enregistrer la remise sur N'IMPORTE QUELLE attestation du
--     pays, y compris celles d'un lotissement concurrent.
--   • Aucune policy SELECT ne lui donne accès aux attestations : ses trois
--     comptes voient **0 ligne sur 51**. C'est la seule chose qui l'empêche
--     aujourd'hui d'exercer ce droit — il ne peut pas atteindre les
--     identifiants.
--
-- Autrement dit, la protection actuelle est l'ignorance d'un UUID, pas un
-- contrôle d'accès. Ajouter la lecture seule — la correction « évidente » —
-- transformerait donc un droit national latent en droit exerçable. C'est
-- exactement le piège que cette migration referme : le périmètre d'écriture est
-- posé AVANT que la lecture ne soit ouverte, dans la même transaction.
--
-- Le périmètre retenu est celui qui existe déjà partout ailleurs pour ce rôle
-- (`lots_read_scope`, `demandes_acquisition`) : le lotissement dont il est
-- l'opérateur, via `mon_operateur_id()`.
--
-- ⚠️ Le test du NULL est ici implicite et sûr : `lo.operateur_id = NULL` n'est
-- jamais vrai, donc un compte non rattaché ne voit rien et ne peut rien. Côté
-- RPC en revanche, le NULL est testé EXPLICITEMENT — c'est la faille corrigée
-- quelques heures plus tôt (migration 20260728130000) : une comparaison à NULL
-- s'évalue à NULL, et une garde qui vaut NULL ne refuse rien.

-- ── 1. Lecture scopée ────────────────────────────────────────────────────────
--
-- Policies séparées plutôt qu'un `OR` ajouté aux policies existantes : elles
-- sont permissives, donc combinées en OU de toute façon, et une policy par rôle
-- se lit, se teste et se retire indépendamment. Même forme que
-- `attcess_chefferie_read`, ajoutée le 13/07 pour la chefferie.

drop policy if exists attcess_operateur_read on public.attestations_cession;
create policy attcess_operateur_read on public.attestations_cession
for select to authenticated
using (
  mon_groupe() = 'operateur'::groupe_utilisateur
  and exists (
    select 1
    from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = attestations_cession.lot_id
      and lo.operateur_id = mon_operateur_id()
  )
);

drop policy if exists attribution_lot_operateur_read on public.attestations_attribution_lot;
create policy attribution_lot_operateur_read on public.attestations_attribution_lot
for select to authenticated
using (
  mon_groupe() = 'operateur'::groupe_utilisateur
  and exists (
    select 1
    from lots l
    join ilots i on i.id = l.ilot_id
    join lotissements lo on lo.id = i.lotissement_id
    where l.id = attestations_attribution_lot.lot_id
      and lo.operateur_id = mon_operateur_id()
  )
);

-- ── 2. Écriture scopée — les quatre fonctions ────────────────────────────────

create or replace function public.signer_attestation(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe        groupe_utilisateur;
  v_statut        statut_att_cession;
  v_autorite      uuid;
  v_lot_operateur uuid;
  v_chefferie     uuid;
  v_operateur     uuid;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id, lo.operateur_id
    into v_statut, v_autorite, v_lot_operateur
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

  if public.est_admin() then
    null; -- constate les trois, partout
  elsif v_groupe = 'operateur' then
    -- Constate les trois, mais UNIQUEMENT sur son parc.
    v_operateur := public.mon_operateur_id();
    if v_operateur is null then
      raise exception 'Votre compte n''est rattache a aucun operateur : aucune signature ne peut etre constatee.';
    end if;
    if v_lot_operateur is null or v_lot_operateur <> v_operateur then
      raise exception 'Ce lotissement ne releve pas de votre perimetre.';
    end if;
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

create or replace function public.signer_attestation_attribution_lot(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe        groupe_utilisateur;
  v_statut        statut_att_cession;
  v_autorite      uuid;
  v_lot_operateur uuid;
  v_paye          timestamptz;
  v_chefferie     uuid;
  v_operateur     uuid;
begin
  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : % (attendu proprietaire, operateur ou chefferie).', p_signature;
  end if;

  select a.statut, lo.autorite_coutumiere_id, lo.operateur_id, a.signature_payee_le
    into v_statut, v_autorite, v_lot_operateur, v_paye
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

  if public.est_admin() then
    null;
  elsif v_groupe = 'operateur' then
    v_operateur := public.mon_operateur_id();
    if v_operateur is null then
      raise exception 'Votre compte n''est rattache a aucun operateur : aucune signature ne peut etre constatee.';
    end if;
    if v_lot_operateur is null or v_lot_operateur <> v_operateur then
      raise exception 'Ce lotissement ne releve pas de votre perimetre.';
    end if;
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

-- Les deux remises. Le contrôle de RÔLE reste en tête — un appelant sans droit
-- doit se voir refuser avant d'apprendre si l'identifiant existe — et le
-- contrôle de PÉRIMÈTRE vient après la lecture, puisqu'il en dépend.

create or replace function public.marquer_attestation_delivree(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requises   text[];
  v_manquantes text[] := '{}';
  v_a          record;
  v_operateur  uuid;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  select a.statut, a.sig_proprietaire_le, a.sig_operateur_le, a.sig_chefferie_le,
         lo.signatures_requises, lo.operateur_id
    into v_a
  from attestations_cession a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  if not public.est_admin() then
    v_operateur := public.mon_operateur_id();
    if v_operateur is null then
      raise exception 'Votre compte n''est rattache a aucun operateur : la remise ne peut pas etre enregistree.';
    end if;
    if v_a.operateur_id is null or v_a.operateur_id <> v_operateur then
      raise exception 'Ce lotissement ne releve pas de votre perimetre.';
    end if;
  end if;

  v_requises := coalesce(v_a.signatures_requises, array['proprietaire','operateur','chefferie']);

  -- Le cast ::text est indispensable : sans lui, `text[] || 'chaine'` resout
  -- vers la concatenation de DEUX tableaux et Postgres tente de parser la
  -- chaine comme un litteral de tableau -- « malformed array literal » a la
  -- place du message utile.
  if 'proprietaire' = any(v_requises) and v_a.sig_proprietaire_le is null then
    v_manquantes := v_manquantes || 'proprietaire terrien'::text;
  end if;
  if 'operateur' = any(v_requises) and v_a.sig_operateur_le is null then
    v_manquantes := v_manquantes || 'operateur'::text;
  end if;
  if 'chefferie' = any(v_requises) and v_a.sig_chefferie_le is null then
    v_manquantes := v_manquantes || 'chefferie'::text;
  end if;

  if array_length(v_manquantes, 1) > 0 then
    raise exception 'Signature(s) manquante(s) avant remise : %.', array_to_string(v_manquantes, ', ');
  end if;

  update public.attestations_cession
  set statut = 'delivree', delivree_le = now(), delivree_par = auth.uid()
  where id = p_id and statut = 'generee';

  if not found then
    raise exception 'Cette attestation n''est pas au statut "Generee" (remise deja enregistree, ou statut incompatible).';
  end if;
end;
$function$;

create or replace function public.marquer_attestation_attribution_lot_delivree(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requises   text[];
  v_manquantes text[] := '{}';
  v_a          record;
  v_operateur  uuid;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  select a.statut, a.sig_proprietaire_le, a.sig_operateur_le, a.sig_chefferie_le,
         lo.signatures_requises, lo.operateur_id
    into v_a
  from attestations_attribution_lot a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  if not public.est_admin() then
    v_operateur := public.mon_operateur_id();
    if v_operateur is null then
      raise exception 'Votre compte n''est rattache a aucun operateur : la remise ne peut pas etre enregistree.';
    end if;
    if v_a.operateur_id is null or v_a.operateur_id <> v_operateur then
      raise exception 'Ce lotissement ne releve pas de votre perimetre.';
    end if;
  end if;

  v_requises := coalesce(v_a.signatures_requises, array['proprietaire','operateur','chefferie']);

  if 'proprietaire' = any(v_requises) and v_a.sig_proprietaire_le is null then
    v_manquantes := v_manquantes || 'proprietaire terrien'::text;
  end if;
  if 'operateur' = any(v_requises) and v_a.sig_operateur_le is null then
    v_manquantes := v_manquantes || 'operateur'::text;
  end if;
  if 'chefferie' = any(v_requises) and v_a.sig_chefferie_le is null then
    v_manquantes := v_manquantes || 'chefferie'::text;
  end if;

  if array_length(v_manquantes, 1) > 0 then
    raise exception 'Signature(s) manquante(s) avant remise : %.', array_to_string(v_manquantes, ', ');
  end if;

  update public.attestations_attribution_lot
  set statut = 'delivree', delivree_le = now(), delivree_par = auth.uid()
  where id = p_id and statut = 'generee';

  if not found then
    raise exception 'Cette attestation n''est pas au statut "Generee" (remise deja enregistree, ou statut incompatible).';
  end if;
end;
$function$;
