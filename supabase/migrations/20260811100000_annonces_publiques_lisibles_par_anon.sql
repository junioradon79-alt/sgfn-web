-- =====================================================================
-- CATALOGUE PUBLIC `annonces_publiques` ILLISIBLE PAR `anon` — CORRECTIF
-- =====================================================================
--
-- CONSTAT, MESURE EN CATALOGUE ET PAR EMPRUNT DU ROLE ANON LE 11/08/2026
-- (transactions read-only, jamais appliquees) :
--
--   set local role anon; select * from public.annonces_publiques limit 1;
--     -> ERROR 42501: permission denied for table lotissements
--
-- MECANISME EXACT (deux causes empilees, les deux mesurees, aucune inferee) :
--
--  (1) `annonces_publiques` est en `security_invoker = true` depuis sa
--      creation (20260711). Elle joint `annonces_marketplace a` et `lots l`.
--      `lots` porte 4 policies SELECT au total, MESURE via `pg_policies` —
--      mais UNE SEULE est reservee a `authenticated` : `lots_read_metier`
--      (`roles={authenticated}`) N'ATTEINT JAMAIS `anon`. Les 3 AUTRES sont
--      permissives pour `public`, donc atteignent bien `anon` :
--      `lots_admin_all` (cmd `ALL`), `lots_marketplace_public_read` (celle
--      qui DEVRAIT suffire : `exists (select 1 from annonces_marketplace a
--      where a.lot_id = lots.id and a.statut = 'active')` — AUCUNE reference
--      a `lotissements`) et `lots_read_scope`, qui REFERENCE
--      `lo.autorite_coutumiere_id`, `lo.operateur_id`,
--      `lo.pv_commissaire_justice_id` (jointure interne a `lotissements`).
--      Ces 3 colonnes ne font PAS partie des 8 seules colonnes de
--      `lotissements` ouvertes a `anon` depuis le 24/07 (id, nom, village,
--      commune, district, superficie_texte, nb_ilots, nb_lots — verifie de
--      nouveau ici, INCHANGE).
--
--      Les policies permissives d'une meme commande se combinent par OR dans
--      LA MEME expression de filtrage. Le CONTROLE DE PRIVILEGE lui-meme a
--      lieu AU DEMARRAGE DE L'EXECUTEUR (`ExecCheckRTPerms`), sur les
--      entrees de privilege qui SURVIVENT A LA PLANIFICATION — il n'y a
--      AUCUN court-circuit A L'EXECUTION (mesure, role anon emprunte,
--      11/08/2026 : une expression bareback `est_admin() or exists(...
--      lo.operateur_id ...)` — la forme REELLE de `lots_read_scope` — echoue
--      en 42501, MEME si `est_admin()` pourrait a l'execution rendre l'autre
--      branche inutile : le controle a deja tranche avant qu'une seule ligne
--      ne soit lue). Il y a en revanche bien une ELIMINATION, MAIS A LA
--      PLANIFICATION, d'une branche PROUVABLEMENT MORTE : `true or x` se
--      simplifie en la constante `true` (regle de simplification booleenne
--      standard du planificateur), et `x` — avec toute relation qu'elle
--      referencait EN PROPRE — ne survit alors pas jusqu'au rangetable final
--      controle par l'executeur (mesure, meme protocole : une expression
--      bareback `true or exists(... lo.operateur_id ...)` PASSE, role anon
--      emprunte, alors que la colonne `lo.operateur_id` n'est pas ouverte a
--      `anon`). Les branches REELLES de `lots_read_scope` ne sont PAS de
--      cette forme : elles reposent sur `est_admin()`, `mon_groupe()`,
--      `ma_chefferie_id()`, `mon_operateur_id()`, `mon_commissaire_id()`,
--      `mon_attributaire_id()` — toutes STABLE (mesure : `est_admin()` a
--      `provolatile = 's'`), jamais IMMUTABLE, donc jamais repliables en
--      constante par le planificateur. Elles survivent donc TOUJOURS jusqu'au
--      controle de l'executeur, et c'est CE controle-la (pas un pretendu
--      controle « avant toute evaluation » universel) qui echoue des que
--      `lotissements` y est referencee hors des 8 colonnes ouvertes. La
--      seule PRESENCE de `lots_read_scope` suffit donc a faire echouer la
--      requete, MEME quand elle ne correspond en rien a sa branche (verifie
--      ci-dessous : une requete qui ne touche QUE la forme de
--      `lots_marketplace_public_read` echoue quand meme) — la CONCLUSION
--      pratique ne change pas, seul le MECANISME invoque est corrige ici.
--
--      PREUVE, role anon reellement emprunte, transaction annulee :
--        select 1 from public.lots limit 1;                        -- 42501
--        select 1 from public.lots l
--          join public.annonces_marketplace a
--            on a.lot_id = l.id and a.statut = 'active' limit 1;    -- 42501
--      Le HINT rendu par PostgreSQL le confirme et illustre le piege :
--        "Grant the required privileges to the current role with:
--         GRANT SELECT ON public.lotissements TO anon;"
--      — suivre ce HINT rouvrirait la table entiere, exactement la fuite
--      GPS/cadastre refermee le 24/07. Ce n'est PAS le correctif retenu ici.
--
--      Ce n'est donc ni un pur privilege de colonne (les colonnes de `lots`
--      elles-memes n'ont AUCUNE restriction : `anon` a SELECT complet au
--      niveau table sur `lots`, mesure), ni une policy qui « repond false » :
--      c'est un CONTROLE DE PRIVILEGE DE COLONNE SUR `lotissements`,
--      DECLENCHE PAR LA REECRITURE RLS de `lots`, AU DEMARRAGE DE
--      L'EXECUTEUR — sur une branche qui SURVIT A LA PLANIFICATION (mesure
--      ci-dessus), jamais par un court-circuit logique a l'evaluation.
--
--  (2) Meme la jointure resolue, la vue appelle
--      `type_document_annonce(a.lot_id)` — SECURITY DEFINER, mais `anon` n'a
--      JAMAIS eu le droit EXECUTE dessus (proacl mesure :
--      {postgres=X,authenticated=X,service_role=X}, aucun `anon=X`).
--      SECURITY DEFINER change les privileges internes a LA FONCTION, pas le
--      droit d'appel : PostgreSQL verifie EXECUTE via
--      `ExecInitFunc -> pg_proc_aclcheck(funcid, GetUserId(), ACL_EXECUTE)`,
--      contre l'INVOQUANT reel — deja documente et mesure sur ce depot le
--      10/08 (20260808100000, §2 : « le role qui insere a bien besoin du
--      droit EXECUTE », meme raisonnement, meme fonction PostgreSQL). Le
--      passage a `security_invoker = false` ne change RIEN a cette
--      verification-la : elle ne porte pas sur une RELATION.
--      PREUVE, role anon emprunte : `select
--      public.type_document_annonce('00000000-0000-0000-0000-000000000000');`
--      -> ERROR 42501: permission denied for function type_document_annonce
--
-- CE QUE SELECTIONNE LA VUE DE `lotissements` : RIEN, DIRECTEMENT. Le SELECT
-- de la vue ne touche jamais `lotissements` — seule la policy INTERNE de
-- `lots` le fait. Colonnes REELLEMENT retournees par la vue (mesure,
-- INCHANGEES par ce fichier) :
--   id, titre, description, prix, usage, zone, superficie_m2, publiee_le,
--   lot_numero, lat_approx (round(latitude,3)), lng_approx (round(longitude,3)),
--   document_type, photo_couverture
-- Aucune colonne de `lotissements`, aucun `lot_id` brut, aucune identite de
-- chefferie/operateur/commissaire, aucune coordonnee exacte (deja arrondie a
-- 3 decimales ~110 m depuis 20260711).
--
-- COMBIEN DE LIGNES AUJOURD'HUI : ZERO. `annonces_marketplace` ne porte
-- qu'UNE seule ligne, statut `suspendue` (mesure : {"statut":"suspendue",
-- "n":1}). La jointure `annonces_marketplace where statut='active' join
-- lots` rend 0 ligne, meme executee sans aucune restriction (verifie en
-- l'executant directement avec le role de connexion, privilegie). Ce
-- correctif ouvre un TUYAU AUJOURD'HUI VIDE ; monterrain-web cessera de
-- LEVER au build (dette produit), sans qu'aucune donnee reelle ne transite
-- encore.
--
-- ---------------------------------------------------------------------
-- CHOIX : `security_invoker = false` SUR LA VUE, PAS DE NOUVELLE RPC
-- ---------------------------------------------------------------------
--
-- Alternative ecartee : une RPC dediee. Rejetee parce que la vue existante
-- est DEJA la fonction la plus etroite possible — sa liste de colonnes a ete
-- ecrite le 20260711 exactement pour cet usage (coordonnees arrondies,
-- aucune colonne `lotissements`) et n'a pas besoin d'etre reecrite ; une RPC
-- aurait duplique cette meme liste sous une autre forme, pour un gain de
-- securite nul et un risque de divergence en plus (deux endroits a tenir a
-- jour au lieu d'un). `security_invoker = false` est un changement DE DEUX
-- MOTS sur un objet dont le perimetre de sortie ne bouge pas.
--
-- ⚠️ VIGILANCE EXPLICITE — meme famille de risque que la dette du 24/07
-- (20260724170000, 4 vues `security_invoker` absent, lisibles par `anon` par
-- un DEFAUT DE SCHEMA non voulu, exposant `lot_id`/`attributaire_id`/
-- `titulaire_registre` en clair). Trois differences verifiees qui font que
-- CE changement-ci n'est PAS une repetition de cette dette :
--
--   (a) Le GRANT `anon` sur `annonces_publiques` PORTE aujourd'hui 8 bits
--       (`relacl` mesure : `anon=arwdDxtm/postgres`). UN SEUL vient d'un
--       grant NOMME et explicite : le `r` (SELECT), pose par
--       `grant select on public.annonces_publiques to anon, authenticated;`
--       (20260711). Les 7 AUTRES (`a,w,d,D,x,t,m` — INSERT/UPDATE/DELETE/
--       TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) viennent bien du DEFAUT DE
--       SCHEMA PUBLIC-vers-`anon` : cette vue a ete creee le 20260711,
--       AVANT la fermeture de ce defaut pour les objets neufs
--       (20260730010000) — dans leur ORIGINE, ces 7 bits ne sont PAS
--       differents du mecanisme qui a cause la fuite du 24/07. La phrase
--       « rien n'est ouvert par accident ici » etait donc fausse au sens
--       strict ; reformulee. Ce qui reste vrai — et c'est la VRAIE
--       difference avec le 24/07 — c'est que ces 7 bits sont INERTES :
--       `annonces_publiques` n'est PAS une vue modifiable (mesure :
--       `information_schema.views.is_updatable = 'NO'`,
--       `is_insertable_into = 'NO'`) ; une vue simple sans regle
--       INSTEAD OF ni trigger n'accepte AUCUNE des commandes que ces 7 bits
--       autoriseraient, quel que soit le grant sous-jacent. SEUL le bit
--       SELECT (`r`) peut jamais s'exercer, et CELUI-LA est explicite et
--       intentionnel depuis l'origine. Le 24/07, c'etait l'inverse : le
--       SELECT lui-meme (le seul bit qui compte reellement) venait du
--       defaut, pas d'un grant nomme.
--   (b) La LISTE DE COLONNES de la vue ne change pas d'un caractere — c'est
--       la meme depuis le 20260711, deja pensee pour un lectorat anonyme.
--       Les 4 vues fautives du 24/07 exposaient au contraire des colonnes
--       JAMAIS destinees au public (identite, cle primaire de lot).
--   (c) Le controle horaire `securite-exposition-anon`
--       (public.controle_exposition_anon_cron, job pg_cron
--       `securite-exposition-anon`) SURVEILLE precisement ce type de
--       reouverture. Sans mise a jour de sa ligne de base, il se
--       declencherait des la prochaine heure (`annonces_publiques` entrerait
--       dans `vues_REELLEMENT_lisibles_hors_allowlist`, et
--       `type_document_annonce(uuid)` dans `fonctions_anon_hors_allowlist`).
--       Ce fichier met cette ligne de base a jour, DELIBEREMENT et sous
--       revue git — exactement ce que 20260730050000 demandait a son propre
--       futur lecteur (« la reouverture devra etre inscrite ici »).
--
-- Ce que la nouvelle lisibilite N'ELARGIT PAS, verifie :
--   * `lotissements` : 0 colonne supplementaire ouverte (la vue ne la lit
--     jamais ; `lots_read_scope` reste inchangee et continue de proteger
--     TOUT AUTRE acces direct a `lots` qui ne passerait pas par cette vue) ;
--   * `lots` : les colonnes deja exposees par la vue restent EXACTEMENT
--     `numero_lot`, `latitude`/`longitude` arrondis — aucune colonne de
--     plus n'est ajoutee au SELECT ;
--   * `type_document_annonce(uuid)` : `anon` peut desormais l'appeler pour
--     N'IMPORTE QUEL `lot_id`, pas seulement ceux d'une annonce active — vrai
--     elargissement, mesure et assume ci-dessous (meme classe de risque que
--     `calculer_score_confiance(uuid)`, deja accorde a `anon` depuis le
--     30/07 et qui revele, pour N'IMPORTE QUEL lot, la presence d'une APFC/
--     d'un guide de repartition — un booleen derive, jamais une ligne brute).
--
-- ⚠️ DETTE RESIDUELLE RELEVEE ICI, HORS MANDAT DE CE FICHIER (non corrigee) :
-- `lots_marketplace_public_read` est aujourd'hui une policy MORTE pour
-- `anon` sur un acces DIRECT a `lots` (hors de cette vue) — elle ne peut
-- jamais s'exercer SEULE, puisque la lecture de `lots` echoue d'abord sur
-- `lotissements` via `lots_read_scope` (policies permissives combinees par
-- OR, mais le controle de privilege de colonne porte sur L'EXPRESSION
-- ENTIERE, cf. mecanisme au §1 ci-dessus). Une vraie solution de fond
-- serait de reecrire `lots_read_scope` pour passer par les helpers
-- `SECURITY DEFINER` deja existants (`ma_chefferie_id()`,
-- `mon_operateur_id()`, `mon_commissaire_id()`) au lieu d'une jointure en
-- clair sur `lotissements` — ce qui rendrait aussi `lots_marketplace_public_read`
-- exercable seule. PAS traite ici : cette migration reste isolee a la
-- reouverture de `annonces_publiques` (vue), qui contourne le probleme sans
-- le resoudre (elle lit `lots` en `security_invoker=false`, donc sans jamais
-- passer par la RLS de `lots`).
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LA VUE — deux mots, perimetre de sortie inchange
-- ---------------------------------------------------------------------
--
-- `alter view ... set (security_invoker = false)` plutot que `drop`+`create`
-- volontairement : `security_invoker=false` est explicite (pas un `reset`
-- silencieux vers un defaut qu'un lecteur futur devrait deviner), et
-- preserve l'OID de la vue, ses GRANTS existants
-- (`anon, authenticated` deja poses le 20260711) et tout commentaire
-- eventuel — aucune fenetre ou la vue serait sans grant.

alter view public.annonces_publiques set (security_invoker = false);

comment on view public.annonces_publiques is
  'Catalogue public des annonces actives (monterrain-web, build SSG, role anon). security_invoker=false DEPUIS le 11/08/2026 (dette : lots_read_scope referencait des colonnes de lotissements fermees a anon, cf. 20260811100000) : la vue s''execute avec les droits de son PROPRIETAIRE (postgres, bypassrls=true), qui contourne la RLS de lots/annonces_marketplace/photos_annonces. Son perimetre de sortie reste borne par sa SEULE liste de colonnes (id, titre, description, prix, usage, zone, superficie_m2, publiee_le, lot_numero, lat_approx, lng_approx, document_type, photo_couverture) : aucune colonne de lotissements, aucun lot_id brut, aucune coordonnee non arrondie. Ne JAMAIS y ajouter une colonne sans revue de securite explicite — un select * futur y verrait desormais les droits du proprietaire, pas ceux de l''appelant.';


-- ---------------------------------------------------------------------
-- 2. LA FONCTION APPELEE PAR LA VUE — l'EXECUTE ne suit PAS le proprietaire
-- ---------------------------------------------------------------------
--
-- Mesure et documentee ci-dessus (§2 du bandeau) : SECURITY DEFINER ne
-- dispense pas l'appelant du droit EXECUTE. Sans ce grant, la vue resterait
-- illisible pour `anon`, cette fois avec "permission denied for function"
-- au lieu de "for table lotissements". `type_document_annonce` ne fait que
-- comparer l'existence d'un `certificats_vente.statut = 'delivree'` pour le
-- lot et renvoyer l'un de 2 libelles fixes ('certificat_vente' /
-- 'attestation_cession') : aucune ligne, aucune colonne brute n'est
-- retournee.

grant execute on function public.type_document_annonce(uuid) to anon;

comment on function public.type_document_annonce(uuid) is
  'Libelle du type de document (attestation_cession/certificat_vente) associe a un lot, derive de certificats_vente.statut. SECURITY DEFINER. Accorde a anon depuis le 11/08/2026 (20260811100000) : appelee par la vue publique annonces_publiques, dont le security_invoker=false ne dispense PAS l''appelant du droit EXECUTE (verifie : ExecInitFunc/pg_proc_aclcheck controle GetUserId(), pas le proprietaire de la vue). Elargissement assume : anon peut desormais interroger ce libelle pour n''importe quel lot_id, pas seulement ceux d''une annonce active — meme classe que calculer_score_confiance(uuid), deja ouverte.';


-- ---------------------------------------------------------------------
-- 3. LE CONTROLE HORAIRE — ligne de base mise a jour, SOUS REVUE GIT
-- ---------------------------------------------------------------------
--
-- Reprend le corps de public.controle_exposition_anon() TEL QUE POSE par
-- 20260730050000, AU CARACTERE PRES, a l'exception de DEUX ajouts et DEUX
-- commentaires corriges pour rester exacts (marques 🆕 ci-dessous) :
--   - `type_document_annonce(uuid)` ajoute a la liste des fonctions admises ;
--   - `annonces_publiques` ajoutee a la liste des vues reellement lisibles
--     admises ;
--   - le commentaire "UNE SEULE" (vue) et "19 FONCTIONS" (implicitement,
--     via le commentaire local) sont mis a jour pour ne pas mentir sur
--     l'etat courant.
-- Rien d'autre ne change : les 63 tables, les 8 colonnes de lotissements,
-- les listes de fonctions/RLS-helpers restants, le mecanisme de sonde par
-- emprunt de role, et controle_exposition_anon_cron() (non touchee ici,
-- son corps ne depend pas de ces listes).

create or replace function public.controle_exposition_anon()
returns jsonb
language plpgsql
volatile
set search_path to pg_catalog, public
as $$
declare
  -- ==================== LIGNE DE BASE ====================
  -- Base 30/07/2026 (20260730050000) + ajout 11/08/2026 (20260811100000,
  -- reouverture DELIBEREE de annonces_publiques). Toute modification passe
  -- par une migration, donc par une revue git.

  -- (i) Fonctions ouvertes a `anon`.
  --     5 RPC de pages sans session :
  c_allowlist_fonctions constant text[] := array[
    'annonce_active_pour_reference(text)',
    'calculer_score_confiance(uuid)',
    'demander_inscription_geometre(text,text,text,text,text,text)',
    'get_public_stats()',
    'valider_invitation(text)',
  --     14 helpers cites dans une policy RLS evaluee pour anon :
    'est_admin()',
    'est_comptable()',
    'ma_chefferie_id()',
    'ma_famille_attributaire_id()',
    'ma_famille_id()',
    'mes_lot_ids()',
    'mon_attributaire_id()',
    'mon_collaborateur_id()',
    'mon_commissaire_id()',
    'mon_geometre_id()',
    'mon_groupe()',
    'mon_operateur_id()',
    'peut_contacter(uuid)',
    'suis_participant(uuid)',
  --  🆕 1 helper appele depuis la vue publique annonces_publiques
  --     (20260811100000, security_invoker=false : l'EXECUTE ne suit pas le
  --     proprietaire de la vue, cf. bandeau de tete) :
    'type_document_annonce(uuid)'
  ];

  -- (ii) Les 63 tables de base sur lesquelles `anon` detient SELECT AU
  --      NIVEAU TABLE au 30/07/2026 : la dette de 20260730020000 (d),
  --      retenue par la seule RLS. Admise mais GELEE. INCHANGE le
  --      11/08/2026 : `lots` et `annonces_marketplace` y figuraient deja.
  --      `lotissements` n'y figure PAS, et ne doit jamais y figurer :
  --      elle est ouverte colonne par colonne, cf. (iii).
  c_tables_select_anon_admises constant text[] := array[
    'annonces_marketplace', 'apports', 'attestations_attribution_lot',
    'attestations_cession', 'attestations_coutumieres', 'attributaires',
    'attributions', 'autorites_coutumieres', 'certificats_vente',
    'cessions', 'chefs_autorites_coutumieres', 'collaborateurs',
    'commissaires_justice', 'constats', 'consultations_qr',
    'conversation_documents', 'conversation_participants', 'conversations',
    'cvgfr', 'demandes_acquisition', 'demandes_contact',
    'demandes_inscription_geometre', 'demarches', 'depenses', 'documents',
    'dossiers_adu', 'echeances', 'familles', 'geometres_experts',
    'grandes_familles', 'grille_commissions', 'ilots', 'invitations',
    'jetons_marketplace', 'journal_audit', 'litiges', 'litiges_suivi',
    'lots', 'marketplace_etat_site', 'messages', 'missions_geometre',
    'notifications', 'notifications_a_envoyer', 'operateurs', 'paiements',
    'parametres_paiement', 'photos_annonces', 'profiles', 'propositions_ia',
    'pv_bornage', 'pv_reunions_famille', 'pv_reunions_famille_lots',
    'pv_reunions_famille_membres', 'repartitions_paiement', 'scans_qr',
    'soumissions_saisie', 'sous_prefectures', 'suivis_parcelle', 'tarifs',
    'tarifs_attestation_chefferie', 'transaction_parties', 'transactions',
    'ventes'
  ];

  -- (iii) ⚠️ LE CAS LEGITIME ET VOULU. Les 8 seules colonnes de `public`
  --       ouvertes NOMMEMENT a `anon` (`anon=r/postgres` dans
  --       `pg_attribute.attacl`). INCHANGE le 11/08/2026 : ce fichier ne
  --       touche AUCUNE colonne de `lotissements` — la vue corrigee ne la
  --       lit jamais, cf. bandeau de tete.
  c_colonnes_anon_admises constant text[] := array[
    'lotissements.id',
    'lotissements.nom',
    'lotissements.village',
    'lotissements.commune',
    'lotissements.district',
    'lotissements.superficie_texte',
    'lotissements.nb_ilots',
    'lotissements.nb_lots'
  ];

  -- (iv) 🆕 Les vues REELLEMENT lisibles par `anon`, role emprunte. DEUX au
  --      11/08/2026 : `photos_annonces_publiques` (mesuree lisible depuis le
  --      30/07) et `annonces_publiques` (reouverte par ce fichier,
  --      security_invoker=false + grant execute type_document_annonce).
  --      Les 7 autres restent a 42501 : elles ne sont pas allowlistees, et
  --      si l'une d'elles devient lisible, ce controle crie.
  c_allowlist_vues_lisibles constant text[] := array[
    'photos_annonces_publiques',
    'annonces_publiques'
  ];

  -- (v) Le seul proprietaire dont les entrees `pg_default_acl` sur `public`
  --     ont le droit de nommer `anon`.
  c_defacl_owner_admis constant text := 'supabase_admin';
  -- ===================================================================

  v_fonctions   jsonb;
  v_tables_rls  jsonb;
  v_grants_tbl  jsonb;
  v_grants_col  jsonb;
  v_acl_public  jsonb;
  v_vues        jsonb;
  v_vues_indet  jsonb;
  v_sonde       jsonb;
  v_defacl      jsonb;
  v_n           integer;

  v_toutes_vues        text[];
  v_vues_lisibles      text[] := array[]::text[];
  v_vues_indeterminees text[] := array[]::text[];
  v_sonde_ko           text   := null;
  v_role_initial       text;
  v_role_sonde         text   := null;
  v_nom                text;
begin
  -- 1a) Une fonction (ou PROCEDURE) de `public` executable par `anon` hors
  --     allowlist. `prokind in ('f','p')` couvre les procedures, que
  --     l'event trigger de 20260730030000 ne filtre pas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'objet', x.ident, 'genre', x.genre, 'mecanisme', x.mecanisme
         ) order by x.ident), '[]'::jsonb)
    into v_fonctions
  from (
    select p.oid::regprocedure::text as ident,
           case p.prokind when 'p' then 'procedure' else 'fonction' end as genre,
           case
             when p.proacl is null
               then 'defaut cable PostgreSQL (proacl NULL, =X implicite a PUBLIC)'
             when exists (select 1 from unnest(p.proacl) a where a::text like 'anon=%')
               then 'grant NOMME anon=X'
             when exists (select 1 from unnest(p.proacl) a where a::text like '=%')
               then 'grant implicite a PUBLIC (=X)'
             else 'herite (appartenance de role)'
           end as mecanisme
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f','p')
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.oid::regprocedure::text <> all (c_allowlist_fonctions)
  ) x;

  -- 1b) Une table de base de `public` sans RLS. Aucune exception admise.
  --     C'est le seul garde-fou des privileges d'ECRITURE de `anon`, qui
  --     sont presents sur les 64 tables (cf. en-tete, point (a)).
  select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    into v_tables_rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;

  -- 1c) SELECT de `anon` AU NIVEAU TABLE, hors des 63 gelees.
  --     `has_table_privilege` est ICI le bon outil : il rend `true` aussi
  --     bien pour `anon=r` que pour un `=r` de PUBLIC, et c'est bien le
  --     niveau TABLE qu'on veut isoler (le niveau colonne est en 1d).
  --     Comparaison a SENS UNIQUE : perdre un grant n'alerte pas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'table', x.relname, 'acl_anon', x.acl) order by x.relname), '[]'::jsonb)
    into v_grants_tbl
  from (
    select c.relname,
           coalesce((select string_agg(a::text, ' | ' order by a::text)
                     from unnest(c.relacl) a
                     where a::text like 'anon=%' or a::text like '=%'),
                    'via appartenance de role') as acl
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')
      and c.relname <> all (c_tables_select_anon_admises)
  ) x;

  -- 1d) GRANTS DE COLONNE nommant `anon` ou PUBLIC, hors des 8 admis. Lu
  --     dans `pg_attribute.attacl` : c'est le SEUL endroit ou un grant de
  --     colonne se voit. `has_table_privilege` et
  --     `information_schema.role_table_grants` sont AVEUGLES ici — lecon
  --     deja payee sur ce projet, et c'est exactement l'angle mort que ce
  --     point ferme. Porte sur les tables ET les vues.
  select coalesce(jsonb_agg(jsonb_build_object(
           'relation', x.relname, 'colonne', x.attname, 'acl', x.acl
         ) order by x.relname, x.attname), '[]'::jsonb)
    into v_grants_col
  from (
    select c.relname, a.attname,
           (select string_agg(y::text, ' | ' order by y::text)
            from unnest(a.attacl) y
            where y::text like 'anon=%' or y::text like '=%') as acl
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m')
      and a.attnum > 0
      and not a.attisdropped
      and a.attacl is not null
      and exists (select 1 from unnest(a.attacl) y
                  where y::text like 'anon=%' or y::text like '=%')
      and (c.relname || '.' || a.attname) <> all (c_colonnes_anon_admises)
  ) x;

  -- 1e) Un aclitem du PSEUDO-ROLE PUBLIC sur une relation de `public`, quel
  --     que soit le privilege. Ligne de base VIDE : zero entretien, signal
  --     maximal. Un aclitem PUBLIC se reconnait a l'absence de beneficiaire
  --     a gauche du `=`.
  select coalesce(jsonb_agg(jsonb_build_object(
           'relation', c.relname,
           'genre', c.relkind::text,
           'acl_public', (select string_agg(y::text, ' | ' order by y::text)
                          from unnest(c.relacl) y where y::text like '=%')
         ) order by c.relname), '[]'::jsonb)
    into v_acl_public
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p','v','m')
    and exists (select 1 from unnest(c.relacl) y where y::text like '=%');

  -- 1f) LISIBILITE REELLE DES VUES, ROLE `anon` EMPRUNTE.
  --
  --     Pourquoi pas `has_table_privilege` : il rend `true` pour toutes les
  --     vues qui portent `anon=arwdDxtm`, quelle que soit leur lisibilite
  --     REELLE. Seul l'emprunt du role tranche.
  --
  --     RESTAURATION DU ROLE — comment elle est GARANTIE : le bloc se
  --     termine TOUJOURS par un `raise` volontaire, ce qui ANNULE le
  --     sous-bloc et RESTAURE avec lui `role`, `request.jwt.claims` et
  --     `statement_timeout`. Les variables plpgsql, elles, SURVIVENT a
  --     l'annulation d'un sous-bloc (comportement documente) : c'est ce qui
  --     permet de sortir le resultat sans laisser de trace. Un `set role`
  --     explicite en ceinture suit, au cas ou.

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[])
    into v_toutes_vues
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v','m');

  v_role_initial := current_user;

  begin
    -- Borne de temps, POSEE SANS ILLUSION : `statement_timeout` s'arme au
    -- debut d'une instruction de PREMIER NIVEAU. Pose ici, au milieu de
    -- l'appel deja en cours, il ne bornera PAS les sondes de cette execution ;
    -- il ne sert qu'a l'appelant qui invoquerait la fonction dans sa propre
    -- instruction suivante. Il est conserve parce qu'il ne coute rien, mais il
    -- ne faut RIEN en attendre : ecrire l'inverse serait un faux vert de plus.
    -- Si un depassement survient malgre tout, il rend 57014, classe en
    -- INDETERMINE ci-dessous — donc en ecart, jamais en vert.
    perform pg_catalog.set_config('statement_timeout', '15s', false);
    -- Sonde deterministe : on veut l'anonyme PUR, meme si l'appelant porte
    -- un JWT dans sa session.
    perform pg_catalog.set_config('request.jwt.claims', '', false);
    execute 'set role anon';
    -- On RELIT le role effectif au lieu de le supposer : c'est le controle
    -- du controle, exploite en 1h.
    v_role_sonde := current_user;

    foreach v_nom in array v_toutes_vues loop
      begin
        -- 🔴🆕 CORRECTIF 11/08/2026 (angle mort mesure, cf. bandeau de tete
        -- §2) : `select 1 from ...` ne REFERENCE aucune colonne de la vue ->
        -- le planificateur peut ELAGUER (column pruning) TOUTE colonne
        -- projetee non demandee par la requete englobante, y compris une
        -- colonne qui appelle une fonction SECURITY DEFINER a laquelle
        -- `anon` n'a PAS l'EXECUTE : la sonde rendrait alors « lisible » une
        -- vue dont la VRAIE requete cliente (`.select("*")`, qui reference
        -- bien CETTE colonne) resterait bloquee. `select *` reference
        -- TOUTES les colonnes de sortie : aucun pruning n'est possible, la
        -- sonde force la MEME evaluation que le client reel.
        -- PREUVE (role anon emprunte, 11/08/2026, isolee de toute RLS de
        -- table : sous-requete SANS FROM sur relation, uniquement des
        -- constantes) : sur une source qui projette a la fois un id constant
        -- et `type_document_annonce(uuid)` (fonction alors SANS grant
        -- EXECUTE pour anon, etat de cette base avant ce fichier) —
        --   select 1 from (select type_document_annonce(...) dt, ...) s
        --     limit 1;                                            -- PASSE (pruning)
        --   select * from (select type_document_annonce(...) dt, ...) s
        --     limit 1;                                             -- 42501
        --   select s.dt from (select type_document_annonce(...) dt, ...) s
        --     limit 1;                                             -- 42501 (forme reelle du client,
        --                                                              monterrain-web/src/lib/annonces.ts:92)
        -- `select *` et la forme reelle du client echouent IDENTIQUEMENT ;
        -- seule l'ancienne forme `select 1` passait a tort. C'est le motif
        -- « un refus lu comme une bonne nouvelle dans le controle cense le
        -- detecter » (cf. dette #45) : ferme ici, dans le controle lui-meme.
        execute pg_catalog.format('select * from public.%I limit 1', v_nom);
        v_vues_lisibles := v_vues_lisibles || v_nom;
      exception
        when insufficient_privilege then
          -- 42501 : la vue est fermee a `anon`. C'est l'etat attendu.
          null;
        when others then
          -- Ni lisible ni franchement refusee : on ne SAIT pas. On le dit,
          -- et cela compte comme un ecart. Un « je ne sais pas » silencieux
          -- serait un faux vert.
          v_vues_indeterminees := v_vues_indeterminees || (v_nom || ' [' || sqlstate || ']');
      end;
    end loop;

    raise exception using errcode = 'P0001', message = '__SONDE_VUES_TERMINEE__';
  exception when others then
    if sqlerrm <> '__SONDE_VUES_TERMINEE__' then
      -- L'emprunt de role lui-meme a echoue : le controle est AVEUGLE sur
      -- les vues. Signale en 1h.
      v_sonde_ko := sqlstate || ' ' || sqlerrm;
    end if;
  end;

  -- Ceinture : l'annulation du sous-bloc a normalement deja restaure le
  -- role. On le verifie, et on le force si besoin.
  if current_user <> v_role_initial then
    execute pg_catalog.format('set role %I', v_role_initial);
  end if;

  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
    into v_vues
  from unnest(v_vues_lisibles) v
  where v <> all (c_allowlist_vues_lisibles);

  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
    into v_vues_indet
  from unnest(v_vues_indeterminees) v;

  -- 1h) La sonde a-t-elle vraiment pris le role `anon` ? Sans ce point, une
  --     sonde inoperante rendrait « aucune vue lisible » et donc 0 ecart :
  --     le plus dangereux des faux verts, puisqu'il ressemble trait pour
  --     trait a un succes.
  v_sonde := case
    when v_sonde_ko is not null then
      jsonb_build_array(jsonb_build_object(
        'probleme', 'SONDE DES VUES INOPERANTE : emprunt du role anon impossible',
        'erreur', v_sonde_ko,
        'role_appelant', v_role_initial))
    when v_role_sonde is distinct from 'anon' then
      jsonb_build_array(jsonb_build_object(
        'probleme', 'SONDE DES VUES INOPERANTE : le role effectif n''etait pas anon',
        'role_effectif', coalesce(v_role_sonde, 'NULL'),
        'role_appelant', v_role_initial))
    else '[]'::jsonb
  end;

  -- 1i) Une entree `pg_default_acl` sur `public` nommant `anon`, au-dela des
  --     3 de `supabase_admin`. C'est la cause racine de tout ce lot.
  select coalesce(jsonb_agg(jsonb_build_object(
           'proprietaire', pg_catalog.pg_get_userbyid(d.defaclrole),
           'objtype', d.defaclobjtype,
           'acl', d.defaclacl::text
         ) order by pg_catalog.pg_get_userbyid(d.defaclrole), d.defaclobjtype), '[]'::jsonb)
    into v_defacl
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and exists (select 1 from unnest(d.defaclacl) a where a::text like 'anon=%')
    and pg_catalog.pg_get_userbyid(d.defaclrole) <> c_defacl_owner_admis;

  v_n := jsonb_array_length(v_fonctions)
       + jsonb_array_length(v_tables_rls)
       + jsonb_array_length(v_grants_tbl)
       + jsonb_array_length(v_grants_col)
       + jsonb_array_length(v_acl_public)
       + jsonb_array_length(v_vues)
       + jsonb_array_length(v_vues_indet)
       + jsonb_array_length(v_sonde)
       + jsonb_array_length(v_defacl);

  return jsonb_build_object(
    'horodatage', now(),
    'nb_ecarts', v_n,
    'ecarts', jsonb_build_object(
      'fonctions_anon_hors_allowlist',                v_fonctions,
      'tables_sans_rls',                              v_tables_rls,
      'tables_select_anon_niveau_table_hors_base',    v_grants_tbl,
      'grants_de_colonne_anon_hors_base',             v_grants_col,
      'relations_avec_aclitem_PUBLIC',                v_acl_public,
      'vues_REELLEMENT_lisibles_hors_allowlist',      v_vues,
      'vues_a_lisibilite_INDETERMINEE',               v_vues_indet,
      'sonde_role_anon_inoperante',                   v_sonde,
      'default_acl_nommant_anon_hors_supabase_admin', v_defacl
    ),
    -- Constat chiffre du moment : sert a diagnostiquer une derive lente
    -- (ex. le nombre de fonctions monte alors qu'aucun ecart n'est signale).
    'constat', jsonb_build_object(
      'nb_fonctions_public', (
        select count(*) from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind in ('f','p')),
      'nb_fonctions_anon', (
        select count(*) from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind in ('f','p')
          and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')),
      'nb_tables_base', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p')),
      'nb_tables_select_anon_niveau_table', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p')
          and pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')),
      'nb_colonnes_ouvertes_a_anon', (
        select count(*) from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m')
          and a.attnum > 0 and not a.attisdropped and a.attacl is not null
          and exists (select 1 from unnest(a.attacl) y where y::text like 'anon=%')),
      'nb_vues', (
        select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('v','m')),
      'vues_REELLEMENT_lisibles_par_anon', to_jsonb(v_vues_lisibles),
      'role_effectif_de_la_sonde', coalesce(v_role_sonde, 'SONDE EN ECHEC'),
      'event_trigger_arme', exists (
        select 1 from pg_catalog.pg_event_trigger
        where evtname = 'evt_fonctions_neuves_fermees_a_anon' and evtenabled = 'O')
    ),
    'ligne_de_base', jsonb_build_object(
      'date', '2026-08-11',
      'source', '20260811100000 (ajoute annonces_publiques + type_document_annonce(uuid) a la base 20260730050000, reouverture deliberee du catalogue marketplace public)',
      'fonctions_admises', to_jsonb(c_allowlist_fonctions),
      'tables_select_anon_admises', to_jsonb(c_tables_select_anon_admises),
      'colonnes_anon_admises', to_jsonb(c_colonnes_anon_admises),
      'vues_reellement_lisibles_admises', to_jsonb(c_allowlist_vues_lisibles),
      'tables_sans_rls_admises', '[]'::jsonb,
      'relations_avec_aclitem_public_admises', '[]'::jsonb,
      'default_acl_proprietaire_admis', c_defacl_owner_admis
    )
  );
end;
$$;

-- Fermeture sur les DEUX mecanismes (PUBLIC et grant nomme), a l'identique
-- de 20260730050000 : le controle ne doit pas etre lui-meme lisible.
revoke execute on function public.controle_exposition_anon() from public, anon;
grant  execute on function public.controle_exposition_anon() to service_role;


-- ---------------------------------------------------------------------
-- 4. VERIFICATION EXECUTEE, PAS SUPPOSEE
-- ---------------------------------------------------------------------
--
-- La plus importante d'abord : le controle CORRIGE doit rendre 0 ecart sur
-- l'etat du jour APRES les §1-2 ci-dessus. Si la ligne de base ou l'un des
-- deux correctifs est faux, cette migration echoue au lieu d'installer un
-- dispositif qui criera au loup des la premiere heure — ou pire, un catalogue
-- qui reste illisible sans que rien ne le signale comme un echec de
-- migration.

do $$
declare
  v_rapport jsonb;
  v_n       integer;
  v_job     record;

  -- Pour la sonde DIRECTE independante plus bas (§ TEST DIRECT) : declarees
  -- ICI, au niveau du bloc do $$, PAS dans un sous-bloc — sinon elles
  -- sortiraient de portee des la fin de leur propre `end;`, exactement comme
  -- `v_role_initial`/`v_role_sonde`/`v_sonde_ko` sont declarees au niveau de
  -- la FONCTION dans controle_exposition_anon(), pas dans son sous-bloc.
  v_role_avant_directe   text;
  v_role_pendant_directe text;
  v_directe_ko           text := null;
begin
  v_rapport := public.controle_exposition_anon();
  v_n := (v_rapport->>'nb_ecarts')::integer;

  if v_n <> 0 then
    raise exception
      'Ligne de base FAUSSE apres 20260811100000 : le controle signale % ecart(s). Detail : %',
      v_n, jsonb_pretty(v_rapport->'ecarts');
  end if;

  -- La sonde a REELLEMENT pris le role `anon`.
  if v_rapport->'constat'->>'role_effectif_de_la_sonde' <> 'anon' then
    raise exception
      'Sonde des vues INOPERANTE : role effectif = %. Le controle serait aveugle sur les vues.',
      v_rapport->'constat'->>'role_effectif_de_la_sonde';
  end if;

  -- 🆕 LA PREUVE CENTRALE DE CE FICHIER : `annonces_publiques` est
  -- REELLEMENT lisible par `anon`, role emprunte — pas seulement supposee
  -- l'etre parce que son security_invoker a change. Si le grant EXECUTE de
  -- type_document_annonce manquait, ou si security_invoker n'avait pas pris,
  -- la vue resterait a 42501 et n'apparaitrait PAS ici : cette assertion
  -- echouerait, et la migration entiere serait annulee.
  if not (v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon') ? 'annonces_publiques' then
    raise exception
      'annonces_publiques N''EST TOUJOURS PAS lisible par anon apres 20260811100000. Vues lisibles : %',
      v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon';
  end if;

  -- Non-regression : photos_annonces_publiques, lisible depuis le 30/07,
  -- doit le rester.
  if not (v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon') ? 'photos_annonces_publiques' then
    raise exception
      'Sonde des vues SUSPECTE : photos_annonces_publiques, mesuree lisible par anon depuis le 30/07/2026, ne l''est plus. Vues lisibles : %',
      v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon';
  end if;

  -- Exactement 2 vues lisibles, ni plus ni moins : une 3e lisible signalerait
  -- une reouverture non voulue AILLEURS, qui devrait faire echouer ce fichier
  -- plutot que de passer inapercue au milieu d'un "0 ecart" trompeur (le
  -- controle lui-meme ne peut pas le voir : une vue en plus SERAIT deja hors
  -- allowlist et remonterait comme ecart — cette assertion est donc une
  -- ceinture, pas le dernier mot).
  if jsonb_array_length(v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon') <> 2 then
    raise exception
      'Nombre de vues lisibles par anon inattendu (attendu 2) : %',
      v_rapport->'constat'->'vues_REELLEMENT_lisibles_par_anon';
  end if;

  -- Le role de l'appelant a bien ete restaure apres la sonde.
  if current_user <> session_user then
    raise exception
      'Le role n''a PAS ete restaure apres la sonde : current_user = %, session_user = %.',
      current_user, session_user;
  end if;

  -- Couverture inchangee sur les tables/colonnes (ce fichier n'y touche pas).
  if (v_rapport->'constat'->>'nb_tables_select_anon_niveau_table')::int < 1
  or (v_rapport->'constat'->>'nb_colonnes_ouvertes_a_anon')::int <> 8 then
    raise exception
      'Compteurs de couverture inattendus : tables SELECT niveau table = %, colonnes ouvertes a anon = % (attendu >=1 et 8).',
      v_rapport->'constat'->>'nb_tables_select_anon_niveau_table',
      v_rapport->'constat'->>'nb_colonnes_ouvertes_a_anon';
  end if;

  -- Le job cron horaire existe toujours, actif, et vise la bonne fonction —
  -- ce fichier ne le touche pas, on verifie juste qu'il tient.
  select jobid, schedule, command, active, username
    into v_job
  from cron.job where jobname = 'securite-exposition-anon';

  if not found then
    raise exception 'Job cron securite-exposition-anon absent.';
  end if;
  if not v_job.active then
    raise exception 'Job cron securite-exposition-anon present mais INACTIF.';
  end if;
  if v_job.command not like '%controle_exposition_anon_cron%' then
    raise exception 'Job cron securite-exposition-anon pointe ailleurs : %', v_job.command;
  end if;

  -- Le controle ne doit pas s'auto-signaler.
  if pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon()', 'EXECUTE')
  or pg_catalog.has_function_privilege('anon', 'public.controle_exposition_anon_cron()', 'EXECUTE') then
    raise exception 'Les fonctions du controle sont elles-memes executables par anon.';
  end if;

  -- La vue porte bien security_invoker=false — controle direct du
  -- reloption, independant de la sonde ci-dessus. EN POSITIF, pas en
  -- negation de l'ancienne valeur : PostgreSQL stocke le LITTERAL tel
  -- qu'ecrit dans `set (...)`, pas un booleen normalise. Mesure sur cette
  -- base : deux vues portent `security_invoker=on`, pas `=true`
  -- (`v_collectifs_pv_manquant`, `v_dossier_adu_completude`) — `on` VAUT
  -- true, mais n'est pas ce TEXTE-la. Une assertion qui se contente de
  -- verifier l'ABSENCE de la chaine `security_invoker=true` passerait donc
  -- au vert sur une vue restee a `on` (true, mais pas ce qu'on verifie) :
  -- corrige ici en verifiant la PRESENCE du texte attendu, jamais
  -- l'absence de l'ancien.
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'annonces_publiques'
      and c.reloptions is not null
      and 'security_invoker=false' = any (c.reloptions)
  ) then
    raise exception 'annonces_publiques ne porte pas security_invoker=false (reloptions actuelles : %).',
      (select c.reloptions from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'annonces_publiques');
  end if;

  -- anon a bien EXECUTE sur type_document_annonce — controle direct, pas
  -- seulement infere du succes de la sonde de vue.
  if not pg_catalog.has_function_privilege('anon', 'public.type_document_annonce(uuid)', 'EXECUTE') then
    raise exception 'anon n''a toujours pas EXECUTE sur type_document_annonce(uuid).';
  end if;

  -- 🆕 TEST DIRECT, INDEPENDANT de controle_exposition_anon() : execute ICI,
  -- dans CE bloc, EXACTEMENT la requete du client reel
  -- (monterrain-web/src/lib/annonces.ts:92, `.select("*")`), role `anon`
  -- reellement emprunte — pas seulement via la boucle generale de la
  -- fonction ci-dessus (deja corrigee, §2 du bandeau de tete). Sonde
  -- deliberement REDONDANTE : une regression FUTURE de la boucle generale
  -- (le meme angle mort de column pruning, sous un autre habillage) ne doit
  -- pas, a elle seule, suffire a faire passer cette migration au vert.
  v_role_avant_directe := current_user;
  begin
    perform pg_catalog.set_config('request.jwt.claims', '', false);
    execute 'set role anon';
    v_role_pendant_directe := current_user;
    -- `PERFORM * FROM ... LIMIT 1` — PAS `PERFORM 1 FROM (select * from ...) x`.
    -- MESURE (11/08/2026, role anon emprunte) : cette derniere forme
    -- REINTRODUIT le meme pruning corrige au §2 du bandeau, un cran plus
    -- loin — le `1` de l'enrobage exterieur ne reference toujours aucune
    -- colonne de `x`, donc le planificateur elague a nouveau TOUT le
    -- contenu du `select *` interne (PASSE a tort, verifie). `PERFORM *`
    -- sans enrobage, en revanche, cible directement toutes les colonnes de
    -- la vue, exactement comme `SELECT * FROM ... LIMIT 1` : ECHOUE en
    -- 42501 quand la vue n'est pas reellement lisible (verifie, meme
    -- protocole, meme fonction sans EXECUTE pour anon).
    perform * from public.annonces_publiques limit 1;
    raise exception using errcode = 'P0001', message = '__SONDE_DIRECTE_TERMINEE__';
  exception when others then
    if sqlerrm <> '__SONDE_DIRECTE_TERMINEE__' then
      v_directe_ko := sqlstate || ' ' || sqlerrm;
    end if;
  end;

  -- Ceinture, au cas ou : l'annulation du sous-bloc restaure normalement deja
  -- le role (meme mecanisme que dans controle_exposition_anon(), documente
  -- au §1f de sa definition).
  if current_user <> v_role_avant_directe then
    execute pg_catalog.format('set role %I', v_role_avant_directe);
  end if;

  if v_directe_ko is not null then
    raise exception
      'Sonde DIRECTE de annonces_publiques (role anon, requete select * reelle) en ECHEC : %. La vraie requete cliente resterait bloquee malgre un controle general silencieux.',
      v_directe_ko;
  end if;

  if v_role_pendant_directe is distinct from 'anon' then
    raise exception
      'Sonde DIRECTE inoperante : le role effectif pendant le test n''etait pas anon (%).',
      coalesce(v_role_pendant_directe, 'NULL');
  end if;

  raise notice
    'annonces_publiques REOUVERTE et VERIFIEE (role anon emprunte). Controle CORRIGE installe et SILENCIEUX (0 ecart). Job % (%), constat : %.',
    v_job.jobid, v_job.schedule, v_rapport->'constat';
end $$;
