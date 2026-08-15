-- =====================================================================
--  VENTILATION INTERNE DE LA COMMISSION SGNF SUR LA SIGNATURE AAL
--  (Attestation d'Attribution de Lot) -- 20 000 FCFA par signature
-- =====================================================================
--
--  Demande du proprietaire du projet (12/08/2026) : enregistrer en base la
--  repartition INTERNE des 20 000 FCFA de commission SGNF percus a chaque
--  paiement de signature Chefferie AAL (`paiements.type =
--  'signature_attribution_lot'`, confirme via `paiements.statut =
--  'confirme'` -- montant fixe par 20260812100000, migration precedente) :
--
--      frais_agregateur                          1 500 FCFA
--      part_beneficiaire_1                       3 000 FCFA
--      commission_chef                           2 000 FCFA
--      commission_sg_chefferie                   1 000 FCFA
--      part_beneficiaire_2                      12 500 FCFA
--      -----------------------------------------------------
--      TOTAL                                    20 000 FCFA
--
--  ⚠️⚠️  CETTE VENTILATION NE DOIT JAMAIS ETRE EXPOSEE A UN ROLE CLIENT NI
--  A UN ECRAN.  ⚠️⚠️  Instruction explicite : « cela ne doit apparaitre
--  nulle part en front end ». Ce fichier est PUREMENT base de donnees --
--  aucun ecran, composant, hook ni route n'est cree ou modifie ici.
--
--  🔴 DEPOT GITHUB PUBLIC -- AUCUN NOM DE PERSONNE DANS CE FICHIER.
--  Le depot GitHub de ce projet est PUBLIC : tout ce qui est committe ici
--  devient indexable sur Internet. Ce fichier ne contient
--  donc, nulle part (DDL, commentaire, message d'exception, `insert`),
--  aucun nom complet reel. Les 5 postes ci-dessus sont des CLES TECHNIQUES
--  neutres, pas des noms. Les noms complets associes a `part_beneficiaire_1`
--  et `part_beneficiaire_2` vivent EXCLUSIVEMENT dans une table de correspondance
--  (section 2 ci-dessous), CREEE VIDE par ce fichier : ils seront inseres
--  separement par le proprietaire du projet, DIRECTEMENT en base, jamais
--  via un fichier suivi par git. Le bloc `do $verif$` en fin de fichier
--  VERIFIE la STRUCTURE deployee (absence de colonne destinee a un nom sur
--  ventilation_commission_sgfn_interne ; presence attendue -- mais VIDE -- de
--  la colonne nom_complet sur beneficiaires_commission_sgfn_interne ; RLS
--  activee sans policy et absence de grants anon/authenticated sur les DEUX
--  tables ; corps de la fonction trigger) -- il ne peut PAS, par
--  construction, verifier l'absence de noms dans le TEXTE SOURCE de ce
--  fichier de migration : une fois la migration appliquee, seul le corps
--  DEPLOYE des fonctions reste inspectable en base, pas le fichier .sql
--  lui-meme. L'absence de noms dans ce texte source releve d'une relecture
--  humaine / d'un verificateur tiers, faite AVANT commit -- pas d'un
--  auto-test SQL.
--
-- ---------------------------------------------------------------------
-- POURQUOI DEUX TABLES SEPAREES (ventilation / correspondance), PAS UNE
-- ---------------------------------------------------------------------
--
-- Une premiere version de ce fichier portait le nom complet directement
-- en colonne (`beneficiaire_nom`) sur la table de ventilation, et l'ecrivait
-- en clair dans le corps du trigger. Un verificateur tiers a rejete cette
-- version : ecrire ces deux noms dans un fichier SQL committe sur un depot
-- PUBLIC les rend indexables sur Internet, quelle que soit la fermeture
-- RLS/ACL de la table qui les recoit (la fermeture protege la LECTURE en
-- base, elle ne protege rien une fois le texte publie sur GitHub).
--
-- La correction structurelle : la table de ventilation ne porte plus AUCUNE
-- colonne texte destinee a un nom (seulement `poste`, une des 5 CLES
-- TECHNIQUES ci-dessus) ; une SECONDE table, purement une table de
-- correspondance poste -> nom, est creee VIDE ici et peuplee separement,
-- hors depot. Meme fermeture (RLS + revoke) sur les deux tables : le
-- cloisonnement ne repose pas sur la table qui est "moins sensible", les
-- deux sont fermees a l'identique.
--
-- ---------------------------------------------------------------------
-- POURQUOI UNE TABLE SEPAREE DE `repartitions_paiement`
-- ---------------------------------------------------------------------
--
-- `repartitions_paiement` existe DEJA (20260709_repartition_paiements.sql)
-- et ventile CHAQUE paiement confirme en 4 `beneficiaire_type`
-- (proprietaire / chefferie / sgfn / agregateur) -- mais cette table est
-- deja AFFICHEE sur `/dashboard/paiements` (bouton « Repartition »,
-- `BENEF_LABELS` dans `src/app/dashboard/paiements/page.tsx`). Elle n'est
-- ni utilisee ni etendue ici : la ventilation ci-dessous vit dans une table
-- ENTIEREMENT NOUVELLE, qu'AUCUN code front-end ne reference, precisement
-- pour que la garantie de confidentialite ne repose jamais sur « aucun
-- ecran ne l'affiche aujourd'hui » (fragile) mais sur une fermeture
-- STRUCTURELLE au niveau base (robuste, verifiee ci-dessous).
--
-- ---------------------------------------------------------------------
-- LE MECANISME DE FERMETURE, ET POURQUOI IL FAUT DEUX GESTES, PAS UN SEUL
-- (applique A L'IDENTIQUE sur les DEUX tables de ce fichier)
-- ---------------------------------------------------------------------
--
-- 1) RLS ACTIVE, ZERO POLICY.
--    `postgres` et `service_role` portent `rolbypassrls = true` (mesure en
--    lecture seule avant d'ecrire ce fichier -- `select rolname,
--    rolbypassrls from pg_roles`) : ils contournent la RLS quelle que soit
--    la table. `anon` et `authenticated` ont `rolbypassrls = false` : sans
--    AUCUNE policy sur ces tables, ils ne peuvent voir ni ecrire AUCUNE
--    ligne, quel que soit le grant qu'ils detiendraient par ailleurs.
--
-- 2) REVOKE EXPLICITE, ET C'EST LE POINT QUI N'ETAIT PAS EVIDENT.
--    `pg_default_acl` a ete relu avant d'ecrire ce fichier :
--
--        owner=postgres, objtype='r' (tables) :
--        {postgres=arwdDxtm/postgres, authenticated=arwdDxtm/postgres,
--         service_role=arwdDxtm/postgres}
--
--    20260730010000 a retire `anon` de ce defaut -- mais PAS
--    `authenticated`, qui reste NOMMEMENT grante en ecriture/lecture
--    COMPLETE (arwdDxtm) sur TOUTE table neuve creee par `postgres`. Sans
--    revoke explicite, `has_table_privilege('authenticated', ...,
--    'SELECT')` rendrait donc TRUE des la creation -- pas a cause d'un
--    oubli de ce fichier, mais parce que c'est le comportement CABLE de ce
--    projet pour `authenticated` sur les tables (seul `anon` a ete corrige
--    par 20260730010000). RLS zero-policy bloque deja la LECTURE DES
--    LIGNES pour ce role (voir point 1), mais le controle qui compte ici
--    est explicite : `has_table_privilege` teste le GRANT, pas la RLS.
--    D'ou le `revoke all ... from authenticated` explicite sur les DEUX
--    tables ci-dessous, en plus de la RLS : DEUX dispositifs independants,
--    chacun suffisant seul, aucun ne repose sur l'autre. `anon` est
--    revoque aussi, par « ceinture et bretelles ».
--
--    Meme lecture faite sur les FONCTIONS avant d'ecrire ce fichier :
--    `pg_default_acl` (owner postgres, objtype 'f') porte deja
--    `{postgres=X, authenticated=X, service_role=X}` -- SANS `anon`
--    nomme -- mais PostgreSQL ajoute en plus, de facon cablee et non
--    documentee dans `pg_default_acl`, un grant EXECUTE a PUBLIC sur toute
--    fonction neuve (`acldefault()`). L'event trigger
--    `evt_fonctions_neuves_fermees_a_anon` (20260730030000) retire ce
--    grant PUBLIC automatiquement des la creation (`ddl_command_end` sur
--    `CREATE FUNCTION`) -- mais lui non plus ne touche pas `authenticated`,
--    qui resterait EXECUTE par defaut sur notre fonction trigger si on ne
--    le revoque pas explicitement. D'ou, en plus de compter sur l'event
--    trigger pour PUBLIC/anon, un `revoke execute ... from public, anon,
--    authenticated` explicite en fin de section 3 ci-dessous.
--
-- ---------------------------------------------------------------------
-- LE DECLENCHEUR : CORPS REEL DE `ventiler_paiement()` LU EN BASE AVANT
-- D'ECRIRE CE FICHIER (20260709_repartition_paiements.sql, confirme
-- identique en production par lecture du fichier source -- aucune
-- migration posterieure ne le retouche)
-- ---------------------------------------------------------------------
--
--   create or replace function public.ventiler_paiement()
--   returns trigger language plpgsql security definer
--   set search_path to 'public' as $function$
--   declare ...
--   begin
--     if new.statut <> 'confirme' then return new; end if;
--     if tg_op = 'UPDATE' and old.statut = 'confirme' then return new; end if; -- deja ventile
--     delete from repartitions_paiement where paiement_id = new.id;
--     if new.type = 'vente_terrain' then ...
--     elsif new.type = 'attestation_cession' then ...
--     else ... end if;
--     return new;
--   end; $function$;
--
--   drop trigger if exists trg_ventiler_paiement on public.paiements;
--   create trigger trg_ventiler_paiement
--     after insert or update on public.paiements
--     for each row execute function public.ventiler_paiement();
--
--   REPRIS A L'IDENTIQUE ci-dessous, sur les deux points qui comptent :
--     - meme garde de CONFIRMATION : `new.statut <> 'confirme'` -> sortie.
--     - meme garde d'IDEMPOTENCE : `tg_op = 'UPDATE' and old.statut =
--       'confirme'` -> sortie (un UPDATE qui change un champ sans rapport,
--       ex. `valide_par`, alors que le paiement est DEJA confirme, ne
--       reventile pas). Un `delete ... where paiement_id = new.id` avant
--       les 5 `insert`, comme `ventiler_paiement()`, en ceinture-et-
--       bretelles de cette meme garde.
--   AJOUTE en plus, propre a cette table : `new.type <>
--   'signature_attribution_lot'` -> sortie, puisque cette ventilation ne
--   concerne QUE ce type de paiement (`ventiler_paiement()` n'a pas cette
--   garde de type, il traite TOUS les types dans un `if/elsif/else`).
--
-- ---------------------------------------------------------------------
-- SECURITY DEFINER : NECESSAIRE, VERIFIE, PAS SUPPOSE
-- ---------------------------------------------------------------------
--
-- La confirmation d'un paiement (`paiements.statut -> 'confirme'`) se fait
-- par UPDATE, et la seule policy RLS d'ecriture sur `paiements` est
-- `paiements_admin_all` (`polcmd = '*'`, `qual = est_admin()`) -- lue en
-- base avant d'ecrire ce fichier. Elle exige un utilisateur `authenticated`
-- satisfaisant `est_admin()`, PAS `postgres` ni `service_role`. Le trigger
-- s'execute donc, la plupart du temps, dans le contexte d'un admin
-- `authenticated` -- role SANS `rolbypassrls` et desormais SANS aucun grant
-- sur cette table (section 2 ci-dessus). Sans `SECURITY DEFINER`, l'INSERT
-- des 5 lignes echouerait avec `permission denied for table
-- ventilation_commission_sgfn_interne`. `SECURITY DEFINER` fait executer la
-- fonction avec les droits de son PROPRIETAIRE (`postgres`, qui possede la
-- table et contourne la RLS) quel que soit l'appelant reel -- exactement le
-- meme besoin, et la meme solution, que `ventiler_paiement()`.
--
-- ---------------------------------------------------------------------
-- AUCUNE RPC N'APPELLE CETTE FONCTION MANUELLEMENT
-- ---------------------------------------------------------------------
--
-- Une fonction trigger (`returns trigger`) n'est de toute facon appelable
-- que par le moteur de triggers de PostgreSQL, jamais par
-- `select ma_fonction()` ni par PostgREST (`/rest/v1/rpc/...`) -- son type
-- de retour l'exclut structurellement d'un appel RPC. Le `revoke execute`
-- de la section 3 est donc une ceinture-et-bretelles sur un risque qui n'a
-- de toute facon pas de porte d'entree, pas une necessite fonctionnelle.
--
-- ---------------------------------------------------------------------
-- LA SIMULATION DE FIN DE FICHIER N'ECRIT JAMAIS DANS `paiements`
-- ---------------------------------------------------------------------
--
-- `paiements` porte NEUF triggers au total (releves avant d'ecrire ce
-- fichier via `pg_get_triggerdef` sur `pg_trigger` -- `trg_paiement`,
-- `trg_calculer_commission_paiement`, `trg_reference_quittance`,
-- `trg_gen_quittance`, `trg_notifier_payeur`, `trg_paiement_active_jeton`,
-- `trg_audit_paiements`, `trg_set_frais_agregateur`, `trg_ventiler_paiement`),
-- plusieurs a fort effet de bord potentiel (notification au payeur,
-- generation de quittance, jeton). `paiements` est par ailleurs VIDE en
-- production a ce jour (confirme par 20260812100000, quelques heures avant
-- ce fichier), donc aucun `paiement_id` reel n'existe pour un test par FK.
-- Le prompt d'origine demande explicitement une simulation « sans ecrire
-- de vraie ligne dans paiements » : la verification ci-dessous ne fait
-- DONC AUCUN insert/update reel sur `paiements`, meme dans une sous-
-- transaction annulee -- elle verifie (a) l'arithmetique des 5 montants,
-- EXTRAITE DU CORPS DEPLOYE (pas une constante recopiee -- voir section 4,
-- point 8), et (b) que le corps DEPLOYE de la fonction trigger contient
-- bien ces 5 COUPLES poste/montant (verifies PAR PAIRE, pas par presence
-- independante -- voir meme point) et sa garde d'idempotence, par lecture
-- de `pg_get_functiondef` (meme technique que 20260812100000). Elle
-- emprunte en revanche REELLEMENT les roles `anon` et `authenticated`
-- (`execute 'set role ...'`, dans une sous-transaction annulee, avec
-- verification EXPLICITE de `current_user` immediatement apres l'emprunt
-- et AVANT toute tentative de lecture -- voir section 4, point 3) pour
-- prouver, et non supposer, qu'ils ne peuvent pas lire ces tables neuves.
--
-- ---------------------------------------------------------------------
-- 🔴 PIEGE DOLLAR-QUOTING DE CE DEPOT
-- ---------------------------------------------------------------------
-- Tout bloc `do` de ce fichier utilise un tag NOMME (`$verif$`,
-- `$function$`), jamais le tag nu deux-dollars, precisement pour ne courir
-- aucun risque avec un caractere dollar litteral qui se glisserait dans un
-- commentaire `--` interne au bloc. Fichier entier relu a la recherche de
-- tout caractere dollar avant d'etre considere termine -- AUCUN present en
-- dehors des tags `$function$` / `$verif$` eux-memes.
--
-- Migration NON idempotente au sens strict (une seule execution prevue),
-- mais rejouable sans casse : `create table if not exists`, `create or
-- replace function`, `drop trigger if exists` + `create trigger`.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LA TABLE DE VENTILATION -- nom qui signale, par sa nomenclature,
--     qu'elle est strictement interne (suffixe `_interne`, comme demande).
--     AUCUNE colonne texte destinee a un nom : seulement les 5 CLES
--     TECHNIQUES (`poste`), jamais un nom complet.
-- ---------------------------------------------------------------------

create table if not exists public.ventilation_commission_sgfn_interne (
  id          uuid primary key default gen_random_uuid(),
  paiement_id uuid not null references public.paiements(id) on delete cascade,
  poste       text not null,
  montant     integer not null,
  cree_le     timestamptz not null default now(),
  constraint ventilation_commission_sgfn_interne_poste_montant_check check (
    (poste = 'frais_agregateur'        and montant = 1500)  or
    (poste = 'part_beneficiaire_1'     and montant = 3000)  or
    (poste = 'commission_chef'         and montant = 2000)  or
    (poste = 'commission_sg_chefferie' and montant = 1000)  or
    (poste = 'part_beneficiaire_2'     and montant = 12500)
  )
);

create index if not exists idx_ventilation_commission_sgfn_interne_paiement
  on public.ventilation_commission_sgfn_interne(paiement_id);

comment on table public.ventilation_commission_sgfn_interne is
  'STRICTEMENT INTERNE -- NE JAMAIS EXPOSER A UN ROLE CLIENT NI A UN ECRAN. '
  'Ventilation de la commission SGNF (20 000 FCFA) percue a chaque signature '
  'Chefferie d''Attestation d''Attribution de Lot, entre 5 postes TECHNIQUES '
  '(frais_agregateur, part_beneficiaire_1, commission_chef, commission_sg_chefferie, '
  'part_beneficiaire_2). Cette table NE PORTE AUCUN NOM : la correspondance poste -> '
  'nom complet vit SEPAREMENT dans public.beneficiaires_commission_sgfn_interne, '
  'jamais ici ni dans aucun fichier de migration. RLS activee sans AUCUNE '
  'policy + revoke explicite anon/authenticated : seuls postgres et '
  'service_role peuvent la lire. Voir 20260812110000.';

-- --- Fermeture explicite, EN PLUS de la RLS (section « mecanisme » ci-dessus) ---
revoke all on public.ventilation_commission_sgfn_interne from public, anon, authenticated;

-- --- RLS activee, ZERO policy : aucun `create policy` ci-dessous, a dessein.
alter table public.ventilation_commission_sgfn_interne enable row level security;

-- --- service_role : deja porteur du grant complet via pg_default_acl
--     (owner postgres), regrante ici de facon EXPLICITE pour que
--     l'intention soit lisible sans dependre d'un defaut qui pourrait
--     changer un jour.
grant select, insert, update, delete on public.ventilation_commission_sgfn_interne to service_role;


-- ---------------------------------------------------------------------
--  2. LA TABLE DE CORRESPONDANCE poste -> nom -- SEPAREE, CREEE VIDE.
--     Aucun `insert` dans ce fichier : le proprietaire du projet peuple
--     cette table lui-meme, directement en base, hors de tout fichier
--     suivi par git (voir instruction SQL fournie a part, hors migration,
--     dans le rapport de cette tache). Meme fermeture EXACTE que la table
--     de ventilation ci-dessus.
-- ---------------------------------------------------------------------

create table if not exists public.beneficiaires_commission_sgfn_interne (
  poste       text primary key
    constraint beneficiaires_commission_sgfn_interne_poste_check check (
      poste in (
        'frais_agregateur', 'part_beneficiaire_1', 'commission_chef',
        'commission_sg_chefferie', 'part_beneficiaire_2'
      )
    ),
  nom_complet text,
  maj_le      timestamptz not null default now()
);

comment on table public.beneficiaires_commission_sgfn_interne is
  'STRICTEMENT INTERNE -- table de correspondance poste TECHNIQUE -> nom '
  'complet des beneficiaires internes de la commission SGNF (voir '
  'public.ventilation_commission_sgfn_interne pour les montants). CREEE '
  'VIDE par la migration 20260812110000 : AUCUN nom n''est ecrit dans '
  'cette migration ni dans aucun fichier suivi par git (depot GitHub '
  'PUBLIC) -- peuplee separement, directement en base, par le proprietaire '
  'du projet. Meme fermeture que la table de ventilation : RLS activee '
  'sans AUCUNE policy + revoke explicite anon/authenticated : seuls '
  'postgres et service_role peuvent la lire.';

-- --- Fermeture explicite, EN PLUS de la RLS -- IDENTIQUE a la table 1. ---
revoke all on public.beneficiaires_commission_sgfn_interne from public, anon, authenticated;

-- --- RLS activee, ZERO policy : aucun `create policy` ci-dessous, a dessein.
alter table public.beneficiaires_commission_sgfn_interne enable row level security;

-- --- service_role : meme regrant explicite qu'a la table 1. ---
grant select, insert, update, delete on public.beneficiaires_commission_sgfn_interne to service_role;


-- ---------------------------------------------------------------------
--  3. LA FONCTION TRIGGER -- meme detection de confirmation et meme garde
--     d'idempotence que `ventiler_paiement()`, plus une garde de TYPE
--     propre a cette table. INSERE LES 5 LIGNES AVEC LES CLES TECHNIQUES
--     SEULEMENT -- AUCUN NOM ECRIT ICI.
-- ---------------------------------------------------------------------

create or replace function public.ventiler_commission_sgfn_interne()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Garde de TYPE : cette ventilation ne concerne que la signature AAL.
  if new.type <> 'signature_attribution_lot' then
    return new;
  end if;

  -- Garde de CONFIRMATION : identique a ventiler_paiement().
  if new.statut <> 'confirme' then
    return new;
  end if;

  -- Garde d'IDEMPOTENCE : identique a ventiler_paiement() -- un UPDATE qui
  -- laisse le statut a 'confirme' (ex. changement de valide_par) ne doit
  -- pas reventiler.
  if tg_op = 'UPDATE' and old.statut = 'confirme' then
    return new;
  end if;

  -- 🔴 Garde de LIEN (ajoutee correctif 3e passe de verification, 12/08/2026) :
  -- cette ventilation ne se declenche QUE pour un paiement reellement emis
  -- par le flux AAL automatique (`generer_attestation_attribution_lot` /
  -- `_maj_attribution_lot_niveau3`), qui inserent tous deux explicitement
  -- `commission_sgfn = 20000` ET renseignent `attestation_attribution_id`.
  -- `paiements.commission_sgfn` porte un DEFAULT de 10000 (pas 20000) : un
  -- paiement `signature_attribution_lot` cree A LA MAIN par un admin, hors de
  -- ce flux, heriterait de ce defaut et ferait echouer la garde de MONTANT
  -- ci-dessous pour une raison qui n'a rien a voir avec une derive tarifaire
  -- reelle -- bloquant en silence (cote UI) la validation d'un paiement par
  -- ailleurs legitime. `attestation_attribution_id is not null` est
  -- precisement le lien qui caracterise le flux automatique : s'il est NULL,
  -- on sort sans rien ventiler (rien de fiable a repartir), sans lever
  -- d'exception -- pas d'echec silencieux CONTRAIRE a l'intention, juste une
  -- absence de ventilation pour un cas hors flux.
  if new.attestation_attribution_id is not null then

    -- Garde de MONTANT (ajoutee le 12/08/2026, meme jour que la migration
    -- precedente qui a deja fait varier ce tarif UNE FOIS : 50 000 -> 20 000).
    -- Les 5 lignes ci-dessous encodent une cle de repartition FIGEE qui
    -- totalise 20 000 FCFA. Si `commission_sgfn` du paiement REELLEMENT
    -- confirme (et lie a une AAL) ne vaut plus 20 000, cette fonction ne doit
    -- surtout pas ventiler silencieusement un montant qui ne correspond plus
    -- a la realite encaissee -- elle doit echouer bruyamment pour forcer une
    -- mise a jour explicite de cette cle de repartition avant de continuer.
    -- `is distinct from` plutot que `<>` : un `commission_sgfn` NULL doit
    -- aussi declencher la garde (`<>` avec NULL renverrait NULL, donc aucune
    -- exception, donc une divergence silencieuse -- exactement ce qu'on veut
    -- empecher). Le message NE DECOMPOSE PAS la cle de repartition
    -- individuelle (pas de "1500+3000+2000+1000+12500") : ce texte transite
    -- par PostgREST jusqu'au client si l'exception se declenche, et ne doit
    -- donc reveler aucun des 5 montants postes.
    if new.commission_sgfn is distinct from 20000 then
      raise exception 'ventiler_commission_sgfn_interne() : commission_sgfn du paiement % (%) ne correspond plus a la cle de repartition figee (20000). Mettre a jour cette fonction (et sa cle de repartition) avant de continuer.', new.id, new.commission_sgfn;
    end if;

    -- Ceinture-et-bretelles, comme ventiler_paiement() : purge avant
    -- reinsertion, au cas ou cette ligne existerait deja.
    delete from ventilation_commission_sgfn_interne where paiement_id = new.id;

    insert into ventilation_commission_sgfn_interne (paiement_id, poste, montant) values
      (new.id, 'frais_agregateur', 1500),
      (new.id, 'part_beneficiaire_1', 3000),
      (new.id, 'commission_chef', 2000),
      (new.id, 'commission_sg_chefferie', 1000),
      (new.id, 'part_beneficiaire_2', 12500);

  end if;

  return new;
end;
$function$;

-- --- Aucun grant EXECUTE pour anon/authenticated/public --------------
-- (l'event trigger evt_fonctions_neuves_fermees_a_anon retire deja PUBLIC
-- automatiquement a la creation ; ce revoke explicite couvre en plus
-- `authenticated`, qui hériterait sinon du defaut EXECUTE de
-- pg_default_acl comme n'importe quelle fonction neuve de ce depot.)
revoke execute on function public.ventiler_commission_sgfn_interne() from public, anon, authenticated;

drop trigger if exists trg_ventiler_commission_sgfn_interne on public.paiements;
create trigger trg_ventiler_commission_sgfn_interne
  after insert or update on public.paiements
  for each row execute function public.ventiler_commission_sgfn_interne();


-- ---------------------------------------------------------------------
--  4. VERIFICATION EXECUTEE, PAS SUPPOSEE
-- ---------------------------------------------------------------------

do $verif$
declare
  v_relrowsecurity boolean;
  v_policy_count   int;
  v_acl_fn         text;
  v_def            text;
  v_trig_def       text;
  v_role_initial   text;
  v_role_apres_set text;
  v_colonnes       text[];
  v_q              constant text := chr(39);  -- une apostrophe litterale
  v_postes         constant text[] := array['frais_agregateur','part_beneficiaire_1','commission_chef','commission_sg_chefferie','part_beneficiaire_2'];
  v_montants       constant int[]  := array[1500,3000,2000,1000,12500];
  v_i              int;
  v_pattern        text;
  v_montant_extrait int;
  v_somme_extraite int := 0;
begin
  v_role_initial := current_user;

  -- ═════════════════════════════════════════════════════════════════
  -- TABLE 1 -- ventilation_commission_sgfn_interne
  -- ═════════════════════════════════════════════════════════════════

  -- ── 1.1) La table existe, porte RLS active, et ZERO policy ─────────
  if to_regclass('public.ventilation_commission_sgfn_interne') is null then
    raise exception 'ventilation_commission_sgfn_interne : table absente apres creation.';
  end if;

  select c.relrowsecurity into v_relrowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'ventilation_commission_sgfn_interne';

  if v_relrowsecurity is distinct from true then
    raise exception 'ventilation_commission_sgfn_interne : RLS NON active (relrowsecurity = %).', v_relrowsecurity;
  end if;

  select count(*) into v_policy_count
  from pg_catalog.pg_policy
  where polrelid = 'public.ventilation_commission_sgfn_interne'::regclass;

  if v_policy_count <> 0 then
    raise exception 'ventilation_commission_sgfn_interne : % policy(ies) presente(s), ZERO attendu.', v_policy_count;
  end if;

  -- ── 1.2) DURCISSEMENT PROPRE A CETTE RECONSTRUCTION : le jeu de
  --      colonnes est EXACTEMENT celui attendu -- ni `beneficiaire_nom`
  --      ni aucune autre colonne texte destinee a un nom ne peut s'y
  --      glisser sans faire echouer cette migration. ───────────────────
  select array_agg(column_name order by column_name) into v_colonnes
  from information_schema.columns
  where table_schema = 'public' and table_name = 'ventilation_commission_sgfn_interne';

  if v_colonnes is distinct from array['cree_le','id','montant','paiement_id','poste'] then
    raise exception 'ventilation_commission_sgfn_interne : jeu de colonnes inattendu (% ) -- une colonne destinee a un nom a-t-elle ete ajoutee ?', v_colonnes;
  end if;

  -- ── 1.3) Aucun grant SELECT/INSERT/UPDATE/DELETE pour anon ─────────
  if pg_catalog.has_table_privilege('anon', 'public.ventilation_commission_sgfn_interne', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.ventilation_commission_sgfn_interne', 'INSERT')
     or pg_catalog.has_table_privilege('anon', 'public.ventilation_commission_sgfn_interne', 'UPDATE')
     or pg_catalog.has_table_privilege('anon', 'public.ventilation_commission_sgfn_interne', 'DELETE')
  then
    raise exception 'ventilation_commission_sgfn_interne : anon detient un grant SELECT/INSERT/UPDATE/DELETE -- inattendu.';
  end if;

  -- ── 1.4) Idem pour authenticated -- LE CONTROLE QUI COMPTE VRAIMENT :
  --      pg_default_acl accorde arwdDxtm a authenticated par defaut sur
  --      toute table neuve de postgres (mesure en tete de fichier). Sans
  --      le `revoke all ... from authenticated` de la section 1, ce
  --      controle aurait echoue. ─────────────────────────────────────
  if pg_catalog.has_table_privilege('authenticated', 'public.ventilation_commission_sgfn_interne', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.ventilation_commission_sgfn_interne', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.ventilation_commission_sgfn_interne', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.ventilation_commission_sgfn_interne', 'DELETE')
  then
    raise exception 'ventilation_commission_sgfn_interne : authenticated detient un grant SELECT/INSERT/UPDATE/DELETE -- le revoke explicite est inoperant.';
  end if;

  -- ── 1.5) PREUVE, PAS SEULEMENT `has_table_privilege` : on EMPRUNTE
  --      reellement les roles anon et authenticated -- MEME IDIOME QUE
  --      20260730050000 (« prendre le role, seul controle qui ne ment
  --      pas »).
  --
  --      🔴 CORRECTIF (defaut releve par un verificateur tiers, 12/08/2026,
  --      reprouve par manipulation en base) : `execute 'set role ...'` ET la
  --      verification de `current_user` sont ICI HORS de tout bloc
  --      `exception when insufficient_privilege` -- un `SET ROLE` vers un
  --      role dont la session courante n'est pas membre leve LUI AUSSI
  --      `insufficient_privilege` (42501), EXACTEMENT le meme SQLSTATE que
  --      celui attendu pour "la lecture a ete refusee". Une version
  --      anterieure de ce fichier plaçait ces deux etapes DANS le bloc
  --      protege : un emprunt de role qui echoue y aurait ete avale par le
  --      handler, et ce test serait passe au VERT sans avoir jamais
  --      reellement emprunte le role ni tente la lecture -- il ne distinguait
  --      pas "j'ai emprunte le role et la lecture a ete refusee" de "je n'ai
  --      meme pas reussi a emprunter le role". Ici, si `set role` ou la
  --      verification de `current_user` echouent, RIEN ne les intercepte :
  --      la migration entiere plante, bruyamment, plutot que d'etre avalee
  --      en silence. Seule la tentative de lecture (`perform 1 from ...`)
  --      reste protegee ci-dessous : c'est SPECIFIQUEMENT ce refus-la qu'on
  --      veut observer et tolerer comme un succes du test. Cette table n'a
  --      ni FK a satisfaire pour un SELECT ni trigger propre : aucun risque
  --      d'effet de bord, contrairement a `paiements`. ─────────────────────
  execute 'set role anon';
  v_role_apres_set := current_user;
  if v_role_apres_set <> 'anon' then
    raise exception 'EMPRUNT DE ROLE ECHOUE : current_user = % apres "set role anon" (attendu anon) -- la tentative de lecture qui suit n''aurait rien prouve.', v_role_apres_set;
  end if;
  begin
    perform 1 from public.ventilation_commission_sgfn_interne limit 1;
    -- Si on arrive ici, AUCUNE erreur n'a ete levee par le SELECT : c'est
    -- l'echec reel a signaler (grant residuel).
    raise exception 'ventilation_commission_sgfn_interne : anon A PU LIRE la table en empruntant reellement le role -- grant residuel.';
  exception
    when insufficient_privilege then
      null; -- attendu : 42501, anon prive de SELECT au niveau table, emprunt de role confirme au prealable
    when others then
      raise; -- relance telle quelle (notre marqueur ci-dessus, ou une erreur vraiment inattendue)
  end;
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  -- Meme correctif que ci-dessus : emprunt de role et verification de
  -- current_user hors du bloc exception, seule la lecture reste protegee.
  execute 'set role authenticated';
  v_role_apres_set := current_user;
  if v_role_apres_set <> 'authenticated' then
    raise exception 'EMPRUNT DE ROLE ECHOUE : current_user = % apres "set role authenticated" (attendu authenticated) -- la tentative de lecture qui suit n''aurait rien prouve.', v_role_apres_set;
  end if;
  begin
    perform 1 from public.ventilation_commission_sgfn_interne limit 1;
    raise exception 'ventilation_commission_sgfn_interne : authenticated A PU LIRE la table en empruntant reellement le role -- grant residuel.';
  exception
    when insufficient_privilege then
      null; -- attendu : 42501, authenticated prive de SELECT au niveau table, emprunt de role confirme au prealable
    when others then
      raise;
  end;
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  -- ═════════════════════════════════════════════════════════════════
  -- TABLE 2 -- beneficiaires_commission_sgfn_interne (meme fermeture)
  -- ═════════════════════════════════════════════════════════════════

  if to_regclass('public.beneficiaires_commission_sgfn_interne') is null then
    raise exception 'beneficiaires_commission_sgfn_interne : table absente apres creation.';
  end if;

  select c.relrowsecurity into v_relrowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'beneficiaires_commission_sgfn_interne';

  if v_relrowsecurity is distinct from true then
    raise exception 'beneficiaires_commission_sgfn_interne : RLS NON active (relrowsecurity = %).', v_relrowsecurity;
  end if;

  select count(*) into v_policy_count
  from pg_catalog.pg_policy
  where polrelid = 'public.beneficiaires_commission_sgfn_interne'::regclass;

  if v_policy_count <> 0 then
    raise exception 'beneficiaires_commission_sgfn_interne : % policy(ies) presente(s), ZERO attendu.', v_policy_count;
  end if;

  select array_agg(column_name order by column_name) into v_colonnes
  from information_schema.columns
  where table_schema = 'public' and table_name = 'beneficiaires_commission_sgfn_interne';

  if v_colonnes is distinct from array['maj_le','nom_complet','poste'] then
    raise exception 'beneficiaires_commission_sgfn_interne : jeu de colonnes inattendu (%).', v_colonnes;
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.beneficiaires_commission_sgfn_interne', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.beneficiaires_commission_sgfn_interne', 'INSERT')
     or pg_catalog.has_table_privilege('anon', 'public.beneficiaires_commission_sgfn_interne', 'UPDATE')
     or pg_catalog.has_table_privilege('anon', 'public.beneficiaires_commission_sgfn_interne', 'DELETE')
  then
    raise exception 'beneficiaires_commission_sgfn_interne : anon detient un grant SELECT/INSERT/UPDATE/DELETE -- inattendu.';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.beneficiaires_commission_sgfn_interne', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.beneficiaires_commission_sgfn_interne', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.beneficiaires_commission_sgfn_interne', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.beneficiaires_commission_sgfn_interne', 'DELETE')
  then
    raise exception 'beneficiaires_commission_sgfn_interne : authenticated detient un grant SELECT/INSERT/UPDATE/DELETE -- le revoke explicite est inoperant.';
  end if;

  -- Meme preuve par emprunt REEL de role, meme correctif qu'en 1.5 :
  -- `set role` et la verification de current_user sont HORS du bloc
  -- exception, seule la tentative de lecture reste protegee.
  execute 'set role anon';
  v_role_apres_set := current_user;
  if v_role_apres_set <> 'anon' then
    raise exception 'EMPRUNT DE ROLE ECHOUE : current_user = % apres "set role anon" (attendu anon) -- la tentative de lecture qui suit n''aurait rien prouve.', v_role_apres_set;
  end if;
  begin
    perform 1 from public.beneficiaires_commission_sgfn_interne limit 1;
    raise exception 'beneficiaires_commission_sgfn_interne : anon A PU LIRE la table en empruntant reellement le role -- grant residuel.';
  exception
    when insufficient_privilege then
      null;
    when others then
      raise;
  end;
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  execute 'set role authenticated';
  v_role_apres_set := current_user;
  if v_role_apres_set <> 'authenticated' then
    raise exception 'EMPRUNT DE ROLE ECHOUE : current_user = % apres "set role authenticated" (attendu authenticated) -- la tentative de lecture qui suit n''aurait rien prouve.', v_role_apres_set;
  end if;
  begin
    perform 1 from public.beneficiaires_commission_sgfn_interne limit 1;
    raise exception 'beneficiaires_commission_sgfn_interne : authenticated A PU LIRE la table en empruntant reellement le role -- grant residuel.';
  exception
    when insufficient_privilege then
      null;
    when others then
      raise;
  end;
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  -- ═════════════════════════════════════════════════════════════════
  -- FONCTION TRIGGER + TRIGGER
  -- ═════════════════════════════════════════════════════════════════

  -- ── 4.1) Aucun grant EXECUTE sur la fonction trigger pour
  --      anon/authenticated, et aucun grant PUBLIC residuel dans son ACL ──
  if pg_catalog.has_function_privilege('anon', 'public.ventiler_commission_sgfn_interne()'::regprocedure, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.ventiler_commission_sgfn_interne()'::regprocedure, 'EXECUTE')
  then
    raise exception 'ventiler_commission_sgfn_interne() : anon ou authenticated peut executer la fonction trigger -- grant inattendu.';
  end if;

  v_acl_fn := coalesce((select proacl::text from pg_catalog.pg_proc
    where oid = 'public.ventiler_commission_sgfn_interne()'::regprocedure), 'NULL');
  if v_acl_fn like '{=X/%' or v_acl_fn like '%,=X/%' then
    raise exception 'ventiler_commission_sgfn_interne() : grant PUBLIC (=X) residuel (proacl = %).', v_acl_fn;
  end if;

  -- ── 4.2) Le trigger existe bien sur paiements, AFTER INSERT OR UPDATE,
  --      et pointe vers notre fonction ──────────────────────────────
  select pg_get_triggerdef(oid) into v_trig_def
  from pg_catalog.pg_trigger
  where tgrelid = 'public.paiements'::regclass
    and tgname = 'trg_ventiler_commission_sgfn_interne'
    and not tgisinternal;

  if v_trig_def is null then
    raise exception 'trg_ventiler_commission_sgfn_interne : trigger absent sur public.paiements apres creation.';
  end if;
  if v_trig_def not ilike '%AFTER INSERT OR UPDATE%'
     or v_trig_def not ilike '%ventiler_commission_sgfn_interne%'
  then
    raise exception 'trg_ventiler_commission_sgfn_interne : definition inattendue : %', v_trig_def;
  end if;

  -- ── 4.3) Le corps DEPLOYE de la fonction contient bien la garde de
  --      type et sa garde d'idempotence -- verification par lecture de
  --      pg_get_functiondef, PAS par execution reelle sur `paiements`
  --      (voir en-tete de fichier). Meme technique que 20260812100000. ──
  v_def := pg_get_functiondef('public.ventiler_commission_sgfn_interne()'::regprocedure);

  if position('signature_attribution_lot' in v_def) = 0 then
    raise exception 'ventiler_commission_sgfn_interne() : garde de type signature_attribution_lot absente du corps deploye.';
  end if;
  if position('old.statut = ''confirme''' in v_def) = 0 or position('tg_op = ''UPDATE''' in v_def) = 0 then
    raise exception 'ventiler_commission_sgfn_interne() : garde d''idempotence (tg_op/old.statut) absente du corps deploye.';
  end if;

  -- ── 4.3bis) 🔴 CORRECTIF (defaut de fond releve par un 3e verificateur,
  --      12/08/2026) : la garde de LIEN (`attestation_attribution_id is not
  --      null`, qui evite de bloquer un paiement AAL cree a la main hors du
  --      flux automatique, avec le DEFAULT 10000 de `paiements.commission_sgfn`)
  --      et la garde de MONTANT (`commission_sgfn is distinct from 20000`)
  --      doivent toutes deux etre presentes dans le corps DEPLOYE -- pas
  --      seulement dans le texte source de cette migration. ────────────────
  if position('new.attestation_attribution_id is not null' in v_def) = 0 then
    raise exception 'ventiler_commission_sgfn_interne() : garde de lien (attestation_attribution_id is not null) absente du corps deploye.';
  end if;
  if position('new.commission_sgfn is distinct from 20000' in v_def) = 0 then
    raise exception 'ventiler_commission_sgfn_interne() : garde de montant (commission_sgfn is distinct from 20000) absente du corps deploye.';
  end if;

  -- ── 4.4) 🔴 CORRECTIFS (defauts a et b releves par le verificateur) :
  --      les 5 montants ne sont plus une CONSTANTE recopiee a la main
  --      (`if (1500+3000+2000+1000+12500) <> 20000` se replie a la
  --      compilation et ne teste RIEN de reel) -- ils sont EXTRAITS du
  --      corps REELLEMENT DEPLOYE via une expression reguliere qui capture
  --      le nombre immediatement apres CHAQUE cle de poste (motif contigu
  --      "'poste', montant", pas "'poste'" et "montant" cherches
  --      independamment) : une permutation de montants entre deux postes
  --      (ex. part_beneficiaire_1 <-> part_beneficiaire_2) ferait donc echouer le controle
  --      PAR PAIRE ci-dessous, meme si les 5 cles et les 5 montants sont
  --      chacun presents QUELQUE PART dans le texte. La somme, elle aussi,
  --      est calculee a partir de ces valeurs EXTRAITES a l'execution --
  --      PostgreSQL ne peut pas la replier a la compilation. ────────────
  for v_i in 1..array_length(v_postes, 1) loop
    v_pattern := v_q || v_postes[v_i] || v_q || '\s*,\s*(\d+)';
    v_montant_extrait := substring(v_def from v_pattern)::int;

    if v_montant_extrait is null then
      raise exception 'ventiler_commission_sgfn_interne() : couple (poste, montant) introuvable sous forme CONTIGUE pour le poste % dans le corps deploye (motif cherche : %).', v_postes[v_i], v_pattern;
    end if;

    if v_montant_extrait <> v_montants[v_i] then
      raise exception 'ventiler_commission_sgfn_interne() : poste % associe, dans le corps DEPLOYE, au montant % -- attendu % (verification par PAIRE poste/montant, pas par presence independante).', v_postes[v_i], v_montant_extrait, v_montants[v_i];
    end if;

    v_somme_extraite := v_somme_extraite + v_montant_extrait;
  end loop;

  if v_somme_extraite <> 20000 then
    raise exception 'ventiler_commission_sgfn_interne() : somme des 5 montants EXTRAITS DU CORPS DEPLOYE = %, attendu 20000.', v_somme_extraite;
  end if;

  raise notice
    'ventilation_commission_sgfn_interne + beneficiaires_commission_sgfn_interne : deux tables, RLS sans policy + zero grant anon/authenticated (has_table_privilege ET emprunt de role reel avec verification de current_user) + fonction trigger fermee (EXECUTE) + corps deploye verifie (5 couples poste/montant PAR PAIRE, garde de type, garde d''idempotence, garde de lien attestation_attribution_id, garde de montant) + somme EXTRAITE = 20000. Absence de noms dans CE fichier de migration verifiee par un tiers avant commit, pas par ce bloc (structure uniquement).';
end;
$verif$;
