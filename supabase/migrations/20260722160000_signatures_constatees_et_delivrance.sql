-- Signatures constatées + délivrance conditionnée (22/07/2026)
--
-- DOCTRINE (tranchée avec le user) : les signatures sont **constatées**, pas
-- électroniques. Le document est signé sur PAPIER ; l'application enregistre
-- seulement qu'elles y figurent, et QUI l'a constaté. C'est la même doctrine
-- que la remise physique tranchée le 13/07 — l'application constate un fait du
-- monde réel, elle ne le remplace pas. La signature électronique reste hors
-- scope, et les trois colonnes existantes ne sont d'ailleurs que des
-- horodatages : aucune clé, aucune preuve cryptographique.
--
-- Conséquence pratique décisive : aucun compte supplémentaire n'est requis.
-- Sur les 41 représentants de famille de rang 1 des deux lotissements, 36
-- n'ont pas de compte — exiger leur connexion aurait rendu la quasi-totalité
-- des attestations indélivrables.
--
-- CE QUI EST CORRIGÉ AU PASSAGE — un défaut silencieux : `/dashboard/validations`
-- faisait un `update` direct de `sig_chefferie_le` alors que la chefferie n'a
-- qu'une policy SELECT sur `attestations_cession`. Sous RLS un update sans
-- policy ne lève AUCUNE erreur : il ne touche 0 ligne. Le bouton « signer » de
-- la chefferie n'a donc jamais rien fait, et le front, qui ne teste que
-- `error`, affichait un succès. Prouvé en transaction annulée. Tout passe
-- désormais par une RPC SECURITY DEFINER qui lève une exception explicite.

-- ── 1. Jeu de signatures requis, par lotissement ─────────────────────────────
--
-- La règle vivait jusqu'ici UNIQUEMENT dans la mise en page PDFMonkey (nombre
-- de blocs de signature du gabarit), donc nulle part où elle puisse être
-- vérifiée. On la fait descendre dans la base.
--
-- La norme est à 3 signatures. Koelea-Accor revu est l'exception historique à
-- 2 (chef de famille + chefferie, sans l'opérateur) : c'est le lotissement
-- d'origine, qui utilise encore le gabarit global. Cette exception n'est
-- déductible d'AUCUNE donnée — les deux lotissements ont un opérateur — d'où
-- une configuration explicite.

alter table public.lotissements
  add column if not exists signatures_requises text[]
    not null default array['proprietaire','operateur','chefferie'];

alter table public.lotissements
  drop constraint if exists lotissements_signatures_requises_valides;
alter table public.lotissements
  add constraint lotissements_signatures_requises_valides
  check (signatures_requises <@ array['proprietaire','operateur','chefferie']
         and array_length(signatures_requises, 1) >= 1);

update public.lotissements
set signatures_requises = array['proprietaire','chefferie']
where nom = 'Koelea-Accor revu';

comment on column public.lotissements.signatures_requises is
  'Signatures exigees avant delivrance d''une attestation de cession de ce '
  'lotissement. Doit refleter le nombre de blocs du gabarit PDFMonkey.';

-- ── 2. Qui a constaté quoi ───────────────────────────────────────────────────
--
-- Les trois colonnes existantes disent QUAND, jamais PAR QUI. Pour un acte
-- dont tout l'intérêt est d'engager un humain, c'est le plus important qui
-- manquait. Même correctif pour la remise physique (`delivree_par`).

alter table public.attestations_cession
  add column if not exists sig_proprietaire_par uuid references public.profiles(id),
  add column if not exists sig_operateur_par    uuid references public.profiles(id),
  add column if not exists sig_chefferie_par    uuid references public.profiles(id),
  add column if not exists delivree_par         uuid references public.profiles(id);

-- ── 3. Constater une signature ───────────────────────────────────────────────
--
-- Admin et opérateur constatent n'importe laquelle des trois (ils tiennent le
-- document papier). La chefferie ne peut constater QUE la sienne, et seulement
-- dans sa juridiction — ce qui répare son bouton sans lui ouvrir la table en
-- écriture.

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
    if v_autorite is null or v_autorite <> public.ma_chefferie_id() then
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

revoke all on function public.signer_attestation(uuid, text) from public;
grant execute on function public.signer_attestation(uuid, text) to authenticated;

-- ── 4. Retirer une signature constatée par erreur ────────────────────────────
--
-- Cocher est faillible ; sans marche arrière, une erreur de saisie bloquerait
-- la délivrance sans recours. Réservé à l'admin.

create or replace function public.annuler_signature_attestation(p_id uuid, p_signature text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if p_signature not in ('proprietaire', 'operateur', 'chefferie') then
    raise exception 'Signature inconnue : %.', p_signature;
  end if;

  if exists (select 1 from attestations_cession where id = p_id and statut = 'delivree') then
    raise exception 'Attestation deja delivree : retirer une signature n''aurait plus de sens.';
  end if;

  if p_signature = 'proprietaire' then
    update attestations_cession set sig_proprietaire_le = null, sig_proprietaire_par = null where id = p_id;
  elsif p_signature = 'operateur' then
    update attestations_cession set sig_operateur_le = null, sig_operateur_par = null where id = p_id;
  else
    update attestations_cession set sig_chefferie_le = null, sig_chefferie_par = null where id = p_id;
  end if;
end;
$function$;

revoke all on function public.annuler_signature_attestation(uuid, text) from public;
grant execute on function public.annuler_signature_attestation(uuid, text) to authenticated;

-- ── 5. La délivrance exige les signatures requises ───────────────────────────
--
-- Jusqu'ici `marquer_attestation_delivree` ne vérifiait que `statut='generee'` :
-- on pouvait remettre une attestation que personne n'avait signée. Le message
-- d'erreur NOMME les signatures manquantes — un refus qui ne dit pas quoi faire
-- se contourne, il ne s'applique pas.

create or replace function public.marquer_attestation_delivree(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requises  text[];
  v_manquantes text[] := '{}';
  v_a         record;
begin
  if not (public.est_admin() or public.mon_groupe() = 'operateur') then
    raise exception 'Action reservee aux administrateurs et operateurs.';
  end if;

  select a.statut, a.sig_proprietaire_le, a.sig_operateur_le, a.sig_chefferie_le,
         lo.signatures_requises
    into v_a
  from attestations_cession a
  join lots l  on l.id = a.lot_id
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  where a.id = p_id;

  if not found then
    raise exception 'Attestation introuvable.';
  end if;

  v_requises := coalesce(v_a.signatures_requises, array['proprietaire','operateur','chefferie']);

  -- Le cast ::text est indispensable : sans lui, `text[] || 'chaine'` resout
  -- vers la concatenation de DEUX tableaux et Postgres tente de parser la
  -- chaine comme un litteral de tableau -- « malformed array literal » a la
  -- place du message utile. Le refus serait bien la, mais illisible.
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
