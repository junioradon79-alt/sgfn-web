-- Nouveau type de soumission : `maj_attributaire` (créer ou corriger la fiche
-- d'un attributaire), pour que l'app mobile puisse le faire depuis le terrain.
--
-- Pourquoi un type de plus et non une écriture directe : `attributaires` n'a
-- qu'une policy d'écriture, `attrib_admin_all`. Tout le reste du registre passe
-- par le maker-checker (`soumettre_saisie` → `approuver_soumission`), qui garde
-- l'auteur, le payload et le résultat appliqué. C'est la seule trace de qui a
-- changé quoi ; ouvrir une écriture directe au mobile la perdrait.
--
-- Aujourd'hui un attributaire ne peut naître que comme effet de bord d'une
-- `maj_attributions` (tableau `nouveaux_attributaires`, référencé par `ref`), et
-- **rien ne permet d'en corriger un existant** — pas même une faute de frappe
-- sur un nom, alors que ce nom figure sur les attestations délivrées.

-- ── Contrainte de type sur la file ───────────────────────────────────────────
-- 🔴 Sans ceci la migration est inopérante : `soumettre_saisie` accepterait bien
-- le nouveau type (whitelist ci-dessous), mais l'INSERT qui suit se ferait
-- rejeter par `soumissions_saisie_type_check`, posée à la création de la table
-- puis élargie une première fois par 20260716141500. Vérifié en base le
-- 26/07/2026 : la contrainte n'énumère que les quatre types précédents.
alter table public.soumissions_saisie drop constraint soumissions_saisie_type_check;
alter table public.soumissions_saisie add constraint soumissions_saisie_type_check
  check (type in (
    'maj_attributions','creation_structure','creation_lotissement',
    'modification_lotissement','maj_attributaire'
  ));

-- ── Application ───────────────────────────────────────────────────────────────
create or replace function public._appliquer_maj_attributaire(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := nullif(p_payload->>'attributaire_id', '')::uuid;
  v_nom text := nullif(btrim(p_payload->>'nom'), '');
begin
  -- 🔴 Convention : **une clé absente laisse la valeur en place, une clé
  -- présente à null l'efface.** `_appliquer_modification_lotissement` ne fait
  -- pas cette distinction et remet à NULL tout champ absent du payload — un
  -- écran qui n'enverrait que le champ corrigé y viderait la fiche entière.
  -- On ne reproduit pas ce piège ici.
  if v_id is null then
    if v_nom is null then
      raise exception 'Nom de l''attributaire manquant.';
    end if;
    insert into attributaires (nom, type, piece_nature, piece_num, telephone, email, adresse, cree_par)
    values (
      v_nom,
      coalesce(nullif(p_payload->>'type', ''), 'personne_physique')::type_attributaire,
      nullif(btrim(p_payload->>'piece_nature'), ''),
      nullif(btrim(p_payload->>'piece_num'), ''),
      nullif(btrim(p_payload->>'telephone'), ''),
      nullif(btrim(p_payload->>'email'), ''),
      nullif(btrim(p_payload->>'adresse'), ''),
      auth.uid()
    )
    returning id into v_id;

    return jsonb_build_object('attributaire_id', v_id, 'cree', true);
  end if;

  if not exists (select 1 from attributaires where id = v_id) then
    raise exception 'Attributaire introuvable.';
  end if;

  update attributaires set
    nom          = case when p_payload ? 'nom'          then coalesce(v_nom, nom) else nom end,
    type         = case when p_payload ? 'type'         then coalesce(nullif(p_payload->>'type', '')::type_attributaire, type) else type end,
    piece_nature = case when p_payload ? 'piece_nature' then nullif(btrim(p_payload->>'piece_nature'), '') else piece_nature end,
    piece_num    = case when p_payload ? 'piece_num'    then nullif(btrim(p_payload->>'piece_num'), '')    else piece_num end,
    telephone    = case when p_payload ? 'telephone'    then nullif(btrim(p_payload->>'telephone'), '')    else telephone end,
    email        = case when p_payload ? 'email'        then nullif(btrim(p_payload->>'email'), '')        else email end,
    adresse      = case when p_payload ? 'adresse'      then nullif(btrim(p_payload->>'adresse'), '')      else adresse end
  where id = v_id;

  return jsonb_build_object('attributaire_id', v_id, 'cree', false);
end;
$$;

comment on function public._appliquer_maj_attributaire(jsonb) is
  'Applique une soumission maj_attributaire : crée si attributaire_id est absent, corrige sinon. Clé absente = valeur inchangée, clé à null = effacement.';

-- ── Autorisation de soumettre ────────────────────────────────────────────────
-- Reprise fidèle de la fonction existante, avec `maj_attributaire` ajouté aux
-- types acceptés et rangé — comme `maj_attributions` et `creation_structure` —
-- dans le domaine de la saisie (admin ou opérateur de saisie).
create or replace function public.soumettre_saisie(
  p_type text,
  p_lotissement_id uuid,
  p_titre text,
  p_payload jsonb,
  p_resume jsonb default null::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
  v_payload jsonb := p_payload;
begin
  if v_caller is null then
    raise exception 'Authentification requise.';
  end if;
  if p_type not in ('maj_attributions','creation_structure','creation_lotissement','modification_lotissement','maj_attributaire') then
    raise exception 'Type de soumission invalide: %', p_type;
  end if;
  if p_payload is null then
    raise exception 'Payload vide.';
  end if;

  if p_type in ('maj_attributions','creation_structure','maj_attributaire') then
    if not (public.est_admin() or public.mon_groupe() = 'operateur_saisie') then
      raise exception 'Action réservée aux opérateurs de saisie.';
    end if;
  else
    if not (public.est_admin() or public.mon_groupe() = 'chefferie') then
      raise exception 'Action réservée aux chefferies.';
    end if;
    if public.mon_groupe() = 'chefferie' then
      v_payload := v_payload || jsonb_build_object('autorite_coutumiere_id', public.ma_chefferie_id());
      if p_type = 'modification_lotissement' and not exists (
        select 1 from lotissements where id = p_lotissement_id and autorite_coutumiere_id = public.ma_chefferie_id()
      ) then
        raise exception 'Ce lotissement n''appartient pas à votre juridiction.';
      end if;
    end if;
  end if;

  insert into soumissions_saisie (auteur_id, type, lotissement_id, titre, payload, resume)
  values (v_caller, p_type, p_lotissement_id, nullif(btrim(p_titre), ''), v_payload, p_resume)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── Dispatch à l'approbation ─────────────────────────────────────────────────
-- Reprise fidèle, avec la seule branche `maj_attributaire` ajoutée.
create or replace function public.approuver_soumission(p_id uuid, p_commentaire text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s   record;
  v_res jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action réservée aux administrateurs.';
  end if;

  select * into v_s from soumissions_saisie where id = p_id for update;
  if not found then
    raise exception 'Soumission introuvable.';
  end if;
  if v_s.statut <> 'en_attente' then
    raise exception 'Soumission déjà traitée (%).', v_s.statut;
  end if;

  if v_s.type = 'maj_attributions' then
    v_res := public._appliquer_maj_attributions(v_s.payload);
  elsif v_s.type = 'creation_structure' then
    v_res := public._appliquer_creation_structure(v_s.payload);
  elsif v_s.type = 'creation_lotissement' then
    v_res := public._appliquer_creation_lotissement(v_s.payload);
  elsif v_s.type = 'modification_lotissement' then
    v_res := public._appliquer_modification_lotissement(v_s.payload);
  elsif v_s.type = 'maj_attributaire' then
    v_res := public._appliquer_maj_attributaire(v_s.payload);
  else
    raise exception 'Type inconnu: %', v_s.type;
  end if;

  update soumissions_saisie
  set statut = 'approuvee',
      traite_par = auth.uid(),
      traite_le = now(),
      commentaire_admin = nullif(btrim(p_commentaire), ''),
      resultat = v_res,
      maj_le = now()
  where id = p_id;

  return v_res;
end;
$$;

-- Les fonctions `_appliquer_*` ne s'appellent que depuis `approuver_soumission`.
revoke all on function public._appliquer_maj_attributaire(jsonb) from public, anon, authenticated;
