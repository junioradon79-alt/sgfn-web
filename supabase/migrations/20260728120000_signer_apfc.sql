-- Constater une signature d'APFC — réparation d'un bouton inopérant depuis
-- toujours.
--
-- 🔴 LE DÉFAUT. `/dashboard/validations` co-signait l'APFC par un `update`
-- DIRECT de `sig_chef_village_le`. Or `attestations_coutumieres` ne porte que
-- deux policies : `apfc_admin_all` (ALL, `est_admin()`) et `apfc_read`
-- (SELECT). Une chefferie n'a donc **aucune** policy d'écriture, et sous RLS
-- un update sans policy ne lève aucune erreur — il touche zéro ligne. Le code
-- ne testant que `error`, l'écran affichait un succès, rechargeait, et la
-- pastille restait grise. Le chef de village croyait avoir signé.
--
-- Prouvé en production le 28/07 sous la session réelle de la chefferie
-- rattachée, dans une transaction annulée :
--   groupe=chefferie, apfc lisibles=1, update a touché 0 ligne(s), erreur=NON
--
-- C'est EXACTEMENT le défaut corrigé le 22/07 sur `sig_chefferie_le` des
-- attestations de cession (migration 20260722160000). La correction n'avait
-- jamais été reportée sur l'APFC, alors que les deux boutons vivent sur le
-- même écran, à quelques lignes l'un de l'autre.
--
-- La règle du dépôt, réaffirmée ici : une écriture dont le droit est
-- CONDITIONNEL passe par une RPC `security definer` qui lève une exception
-- explicite, jamais par un `update` direct.

-- ── 1. Traçabilité du constat ────────────────────────────────────────────────
--
-- `attestations_coutumieres` n'a AUCUN trigger (ni audit, ni horodatage) :
-- vérifié en production le 28/07. Sans ces colonnes, on saurait qu'une
-- signature a été constatée mais jamais par qui — alors que c'est précisément
-- ce que « constater » veut dire : quelqu'un engage sa responsabilité en
-- affirmant que la signature figure sur le papier. Mêmes colonnes que
-- `attestations_cession`, ajoutées pour la même raison le 22/07.

alter table public.attestations_coutumieres
  add column if not exists sig_chef_famille_par uuid references public.profiles(id),
  add column if not exists sig_chef_village_par uuid references public.profiles(id),
  add column if not exists sig_cvgfr_par        uuid references public.profiles(id);

-- ── 2. La RPC ────────────────────────────────────────────────────────────────
--
-- Admin constate les trois (il tient le document). La chefferie ne constate
-- QUE celle du chef de village, et seulement dans sa juridiction — ce qui
-- répare son bouton sans lui ouvrir la table en écriture.
--
-- ⚠️ `chef_famille` et `cvgfr` n'ont volontairement AUCUN chemin ouvert à un
-- rôle non-admin : aucun écran ne les propose aujourd'hui. `proprietaire_terrien`
-- serait le candidat naturel pour `chef_famille` (`apfc_read` le laisse déjà
-- lire les APFC de sa famille), mais lui ouvrir l'écriture sans écran qui
-- l'utilise créerait une capacité fantôme de plus — exactement ce que le
-- registre des leçons du 22/07 demande d'éviter. À ouvrir le jour où l'écran
-- existe, pas avant.

create or replace function public.signer_apfc(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_groupe   groupe_utilisateur;
  v_autorite uuid;
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
    -- Le rattachement est porté par l'APFC elle-même (héritée du lotissement à
    -- sa création), et non par une jointure : c'est la colonne sur laquelle
    -- `apfc_read` scope déjà la lecture de la chefferie.
    if v_autorite is null or v_autorite <> public.ma_chefferie_id() then
      raise exception 'Cette APFC ne releve pas de votre juridiction.';
    end if;
  else
    raise exception 'Action reservee a l''administration et a la chefferie.';
  end if;

  -- Idempotent : re-constater ne réécrit pas l'horodatage d'origine, ni son
  -- auteur. Retaper le bouton ne doit pas transférer la responsabilité du
  -- constat à la dernière personne qui a cliqué.
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

revoke all on function public.signer_apfc(uuid, text) from public;
grant execute on function public.signer_apfc(uuid, text) to authenticated;
