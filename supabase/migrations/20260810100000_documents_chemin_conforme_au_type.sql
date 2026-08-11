-- =====================================================================
--  DETTE #49 — LE LIEN type -> PREFIXE, IMPOSE EN BASE
--
--  Enonce d'origine de la dette (§4.3 du document directeur), VERBATIM :
--    « `telecharger-document` signe en `service_role` le chemin que la
--      LIGNE declare, sans valider aucun prefixe. […] La ligne est relue
--      avec le jeton de l'appelant, donc le controle RLS passe : c'est
--      bien SA ligne. Mais le chemin qu'elle declare n'est jamais valide.
--      Consequence generale : qui peut INSERER une ligne dans `documents`
--      peut LIRE n'importe quel objet du bucket prive. »
--
--  ── POURQUOI CE FICHIER EXISTE, ALORS QUE LE CORRECTIF EST APPLICATIF ─
--  Le correctif de fond de #49 est dans les edge functions : elles
--  valident desormais le chemin avant de le signer (`telecharger-document`)
--  ou de le lire (`convertir-plan-cad`). Cette migration ne le remplace
--  pas, elle le DOUBLE — et c'est un arbitrage explicite du proprietaire
--  du projet, pris le 10/08/2026 :
--
--    « Le 09/08 a montre qu'une garde applicative se fait rouvrir par une
--      colonne voisine oubliee ; la base, elle, ne s'oublie pas — et le
--      cout mesure est nul. »
--
--  Le fait invoque est reel et date : 20260809100000 (§5) documente une
--  premiere correction, declaree complete, qui ne contraignait que
--  `url_fichier` ; `apercu_url` rouvrait integralement la fuite parce que
--  l'edge function choisit la colonne selon un `variant` fourni par le
--  CLIENT. Une contrainte de table ne connait pas cette distinction :
--  elle voit les deux colonnes, toujours.
--
--  ── MESURE AVANT, EN PRODUCTION (10/08/2026, lecture seule) ───────────
--  Le predicat du §1 a ete evalue TEL QUEL sur les 179 lignes :
--      url_fichier NON conforme : 0
--      apercu_url  NON conforme : 0   (1 seule non NULL : plans-cad/<id>/apercu.png)
--  Repartition reelle, un seul prefixe par type, sur 100 % des lignes :
--      attestation_cession             158  attestations_cession/
--      quittance                        10  paiements/
--      certificat_propriete_coutumiere   6  attestations_coutumieres/
--      certificat_vente                  2  certificats_vente/
--      plan_lot                          2  plans-cad/
--      pv_bornage                        1  pv_bornage/
--  Cout de la fermeture : NUL. Aucune ligne n'est reecrite, aucune n'est
--  supprimee, ce fichier ne touche pas une donnee.
--
--  ── 🔴 LE RISQUE SYMETRIQUE, VERIFIE AVANT D'ECRIRE ───────────────────
--  Une contrainte contraint aussi CEUX QUI ECRIVENT LEGITIMEMENT. Les
--  ecrivains ont ete relus, pas supposes :
--
--   (a) `generation-document` (service_role, index.ts:813-816) construit
--         chemin = `${table}/${reference ?? numero ?? id}.${ext}`
--         type   = CONFIG[table].type_doc
--       Le PREFIXE est donc le NOM DE LA TABLE, et les six entrees de son
--       CONFIG correspondent une a une a la table du §1 :
--         attestations_cession         -> attestation_cession
--         attestations_attribution_lot -> attestation_attribution
--         certificats_vente            -> certificat_vente
--         attestations_coutumieres     -> certificat_propriete_coutumiere
--         paiements                    -> quittance
--         pv_bornage                   -> pv_bornage
--       Les six sont conformes. ⚠️ Le NOM DE FICHIER, lui, peut venir d'un
--       repli (`numero`, puis `id`) : `attestations_coutumieres.reference`
--       et `paiements.reference` sont NULLABLE (relu le 10/08). C'est
--       precisement pourquoi le §1 ne dit RIEN du nom de fichier : il
--       imposerait une forme que personne ne maitrise, et casserait la
--       generation de documents en production pour un gain nul.
--
--   (b) `src/features/lotissements/services/plans.service.ts:114` ecrit
--       `plans-lotissement/<lotissementId>/<documentId>.<ext>` pour le type
--       `plan_lotissement`, et `src/components/dashboard/UploadPlanModal.tsx:96`
--       ecrit `plans-cad/<documentId>/original.dxf` pour `plan_lot`.
--       Conformes tous les deux.
--
--  ── 🔴 CE QUE `else false` INTERDIT — A LIRE AVANT DE S'EN ETONNER ────
--  L'enum `type_document` porte 21 valeurs ; 8 seulement ont un prefixe
--  connu. Les 13 autres — `apfc`, `piece_identite`, `acte_vente`, `acd`,
--  `titre_foncier`, `autre`, `pv_constatation`,
--  `attestation_non_contestation`, `plan_localisation`,
--  `certificat_residence`, `demande_adu`, `adu`, `pv_reunion_famille` —
--  deviennent INSERABLES NULLE PART tant que leur prefixe n'est pas
--  declare au §1. Elles portent 0 ligne aujourd'hui et aucun code du
--  depot n'en ecrit, donc rien ne casse a l'application.
--
--  Le choix de `else false` plutot que `else true` est delibere : un type
--  sans prefixe declare produirait une ligne dont la garde applicative
--  refusera ensuite de servir le fichier (fail-closed des deux cotes). On
--  aurait donc un document televerse, visible a l'ecran, et
--  INTELECHARGEABLE — une panne silencieuse. Mieux vaut un refus immediat
--  et nommable a l'ecriture. Pour ouvrir un type, DEUX gestes, et ils
--  vont ensemble :
--    1. ajouter sa branche `when '<type>'::type_document then ...` au §1 ;
--    2. ajouter la meme entree a `PREFIXE_PAR_TYPE` dans
--       `supabase/functions/telecharger-document/index.ts`.
--  `scripts/e2e-dette-49-chemin-signe.mjs` COMPARE les deux tables et
--  ECHOUE si l'une avance sans l'autre : la divergence est tenue par une
--  machine, pas par une relecture.
--
--  ── CE QUE CETTE CONTRAINTE NE FAIT PAS ──────────────────────────────
--   · Elle n'empeche PAS une ligne de designer le fichier d'une AUTRE
--     ligne du MEME type (sauf `plan_lot`, dont le dossier doit etre son
--     propre id — clause portee par la garde applicative et par le
--     `with check` de `documents_geometre_plans_insert`). Fermer cela
--     exigerait de lier `url_fichier` a la reference de l'acte : regle
--     metier, pas garde de chemin.
--   · Elle ne borne ni la taille ni le type MIME du binaire — reglage de
--     bucket, pas contrainte de table (constat du 29/07, inchange).
--   · Elle ne remplace aucune policy. Les policies disent QUI ecrit ;
--     celle-ci dit QUOI peut etre ecrit. Les deux sont necessaires : au
--     10/08, la seule policy d'ecriture hors admin est
--     `documents_geometre_plans_insert`, et le jour ou une deuxieme
--     apparait (depot chefferie, operateur, maker-checker), c'est cette
--     contrainte-ci qui empechera qu'elle rouvre #49 sans que personne
--     ne relise l'edge function.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LA TABLE DES PREFIXES, EN UNE SEULE FONCTION
--
--  Ecrite une fois et appelee trois fois (le garde-fou du §3, et les deux
--  colonnes de la contrainte du §4) plutot que recopiee : c'est la meme
--  raison qui fait comparer octet par octet les deux copies de la garde
--  applicative. Une regle de securite recopiee a la main diverge — ce
--  depot en a la preuve datee.
--
--  ── POURQUOI `immutable` EST LICITE ICI ──────────────────────────────
--  Une contrainte CHECK n'accepte que des fonctions IMMUTABLE. Celle-ci
--  l'est REELLEMENT : elle ne lit aucune table, aucun parametre de
--  session, aucune heure. Elle ne depend que de ses deux arguments. Ce
--  n'est pas une declaration de complaisance — c'en serait une si elle
--  interrogeait `documents` ou `current_setting()`.
--
--  ── PAS DE `security definer`, ET C'EST VOULU ────────────────────────
--  Elle ne lit rien ; il n'y a donc aucune RLS a contourner. Un
--  `security definer` inutile est une surface offerte pour rien.
--
--  ── 🔴 `starts_with()` ET `position()`, JAMAIS `like` ────────────────
--  Deux pieges de `like` ont ete trouves dans une premiere redaction de
--  ce fichier, avant application. Ils sont ecrits ici parce que tous deux
--  passent la relecture :
--
--   (a) `p_chemin like 'attestations_cession/%'` est FAUX. Dans un motif
--       LIKE, `_` est un JOKER. Mesure en production le 10/08, LIKE contre
--       `starts_with` sur la meme chaine :
--           attestationsXcession/vole.pdf   like=true  starts_with=false
--           attestations-cession/vole.pdf   like=true  starts_with=false
--           attestations cession/vole.pdf   like=true  starts_with=false
--           pvXbornage/vole.pdf             like=true  starts_with=false
--           pv-bornage/vole.pdf             like=true  starts_with=false
--       Quatre des huit prefixes portent un souligne
--       (`attestations_cession`, `attestations_attribution_lot`,
--       `attestations_coutumieres`, `pv_bornage`), donc quatre des huit
--       branches auraient accepte des prefixes qu'elles n'annoncaient pas.
--       `starts_with()` compare des caracteres, pas un motif.
--       ⚠️ Le premier contre-exemple ecrit ici (`attestationsXcessionY/…`)
--       rendait `false` — il portait un caractere de trop avant le slash,
--       et faisait donc conclure a tort que le piege etait theorique. Un
--       contre-exemple qui echoue ne prouve rien : il a fallu le refaire a
--       longueur egale. C'est note pour le prochain lecteur tente de
--       verifier de tete.
--
--   (b) `p_chemin not like '%\%'` ne teste PAS la presence d'un
--       antislash. `\` est le caractere d'echappement par defaut de LIKE :
--       ce motif signifie « ne se termine pas par un `%` litteral ». Le
--       bannissement de l'antislash — celui qui compte, parce que le
--       parseur d'URL le convertit en `/` — n'aurait donc PAS existe.
--       Mesure en production le 10/08, sur `plans-cad\x/original.dwg` :
--           not like '%\%'            => true    (le bannissement NE TIRE PAS)
--           position(chr(92) in …) = 0 => false   (l'antislash est vu)
--       `position(chr(92) …)` ne depend ni de LIKE, ni de
--       `standard_conforming_strings`, ni de la relecture d'un lecteur qui
--       compte les antislashs.
--
--  ── 🔴 UNE LISTE BLANCHE, PAS UNE LISTE NOIRE ────────────────────────
--  Une premiere redaction bannissait `..`, `/` initial et `\`, et
--  laissait passer tout le reste — en argumentant que « la base tient le
--  lien type -> prefixe, l'application tient la forme du chemin ». Le
--  verificateur a montre ou ce partage menait : la garde applicative
--  refuse aussi l'espace, `"`, `<`, `>`, `^`, `` ` ``, `{`, `}` et TOUT
--  NON-ASCII (le parseur d'URL les reencode, l'egalite tombe). La base
--  les acceptait. On aurait donc pu ecrire une ligne et deposer un
--  fichier que le telechargement refuserait ENSUITE, definitivement :
--  `attestations_coutumieres/APFC-Ebimpe-2022-001.pdf` accentue en est
--  l'exemple exact. Stocker ce qu'on ne sait pas servir, c'est fabriquer
--  un 404 permanent et un orphelin de plus.
--
--  La classe ci-dessous n'est pas devinee : elle a ete DERIVEE de la
--  garde, caractere par caractere (`scratchpad/a3-charset.mjs` interroge
--  `motifDeRefusDuChemin` sur les 95 ASCII imprimables et 16 non-ASCII
--  representatifs), puis verifiee en production. C'est EXACTEMENT
--  l'ensemble que la garde accepte :
--      A-Z a-z 0-9  ! $ & ' ( ) * + , - . / : ; = @ [ ] _ | ~
--
--  Et c'est une liste BLANCHE pour la meme raison qui a fait remplacer la
--  liste noire de la garde par une egalite d'URL : une liste noire se
--  fait deborder par le caractere que personne n'a nomme. C'est deja
--  arrive une fois sur ce correctif, avec `#`.
--
--  ── MESURE (10/08, production, lecture seule) ────────────────────────
--      url_fichier hors classe : 0   /179
--      apercu_url  hors classe : 0   /1 non NULL
--      references hors classe  : 0   /108  (106 cessions + 1 APFC + 1 numero)
--  Contre-epreuve dans le meme passage : les 11 caracteres ASCII refuses
--  par la garde le sont aussi par cette classe, et
--  `attestations_coutumieres/APFC-Ebimpe-2022-001.pdf` ACCENTUE est
--  refuse — alors que les trois chemins reels testes passent.
--
--  ⚠️ Reste vrai malgre la liste blanche : le nom de fichier peut venir
--  des replis `numero` puis `id` de `generation-document`. `numero` est
--  du texte libre. Si un jour un numero porte un accent, l'INSERT sera
--  refuse — bruyamment, a la generation, plutot que silencieusement au
--  telechargement six mois plus tard. C'est le bon sens du refus.
--
--  `..` reste banni separement : il est compose de caracteres autorises.
-- ---------------------------------------------------------------------

create or replace function public.documents_chemin_suit_le_type(
  p_type public.type_document,
  p_chemin text
)
returns boolean
language sql
immutable
as $function$
  select p_chemin is not null
     and length(p_chemin) > 0
     -- LISTE BLANCHE : exactement ce que la garde applicative accepte.
     -- Elle exclut d'office l'antislash, l'espace, `"`, `#`, `%`, `<`,
     -- `>`, `?`, `^`, backtick, `{`, `}`, les caracteres de controle et
     -- tout non-ASCII — sans avoir a les nommer un a un.
     -- ⚠️ Cette classe est comparee A LA GARDE, caractere par caractere,
     -- sur les 110 codes du domaine, par le §⑦ de
     -- scripts/e2e-dette-49-chemin-signe.mjs. Une divergence FAIT ECHOUER
     -- la preuve : elargir l'une sans l'autre n'est plus possible en
     -- silence (c'etait le cas jusqu'au 4e tour — la classe SQL pouvait
     -- deriver de 7 caracteres sans qu'aucun controle ne bronche).
     and p_chemin ~ '^[A-Za-z0-9!$&''()*+,./:;=@\[\]_|~-]+$'
     -- `..` est compose de caracteres autorises : il se bannit a part.
     and position('..' in p_chemin) = 0
     and left(p_chemin, 1) <> '/'
     -- ── LE RESIDUEL, FERME AU 4e TOUR ────────────────────────────────
     -- Ces quatre formes passaient la contrainte et sont refusees A JAMAIS
     -- par la garde applicative : on aurait donc stocke un fichier et ecrit
     -- une ligne pour un document en 404 permanent — exactement le
     -- « stocker ce qu'on ne sait pas servir » que le bandeau du §1 dit
     -- vouloir empecher.
     -- Cout mesure en production le 10/08 : ZERO ligne sur 179.
     --   segment vide (`//`) : 0   slash final : 0   segment `.` : 0
     --   longueur > 512 : 0        sans dossier : 0
     --   longueur maximale reellement observee : 59 caracteres
     and position('//' in p_chemin) = 0
     and right(p_chemin, 1) <> '/'
     and p_chemin !~ '(^|/)\.(/|$)'
     and length(p_chemin) <= 512
     and position('/' in p_chemin) > 0
     and case p_type
           when 'attestation_cession'::public.type_document
             then starts_with(p_chemin, 'attestations_cession/')
           when 'attestation_attribution'::public.type_document
             then starts_with(p_chemin, 'attestations_attribution_lot/')
           when 'certificat_vente'::public.type_document
             then starts_with(p_chemin, 'certificats_vente/')
           when 'certificat_propriete_coutumiere'::public.type_document
             then starts_with(p_chemin, 'attestations_coutumieres/')
           when 'quittance'::public.type_document
             then starts_with(p_chemin, 'paiements/')
           when 'pv_bornage'::public.type_document
             then starts_with(p_chemin, 'pv_bornage/')
           when 'plan_lot'::public.type_document
             then starts_with(p_chemin, 'plans-cad/')
           when 'plan_lotissement'::public.type_document
             then starts_with(p_chemin, 'plans-lotissement/')
           -- Fail-closed : un type sans prefixe declare n'est ecrivable
           -- nulle part. Voir le bandeau de tete pour la liste des 13
           -- types concernes et les deux gestes pour en ouvrir un.
           else false
         end;
$function$;

comment on function public.documents_chemin_suit_le_type(public.type_document, text) is
  'Vrai si le chemin de stockage passe respecte le prefixe attendu pour ce type_document, et ne porte aucune forme de traversee (.., antislash, / initial). Porte la contrainte documents_chemin_conforme_au_type (dette #49, 10/08/2026). Table des prefixes MESUREE en production : 179/179 lignes conformes. Doit rester alignee avec PREFIXE_PAR_TYPE de supabase/functions/telecharger-document/index.ts — scripts/e2e-dette-49-chemin-signe.mjs compare les deux et echoue en cas de divergence. Fail-closed : les 13 valeurs d''enum sans prefixe declare ne sont inserables nulle part.';


-- ---------------------------------------------------------------------
--  2. ACL — le defaut d'execution de ce projet est CABLE vers PUBLIC
--
--  PostgreSQL accorde EXECUTE a PUBLIC sur toute fonction neuve, par un
--  defaut cable en dur qui n'apparait dans aucun `pg_default_acl` et ne
--  se voit qu'en lisant `proacl is null`. `revoke ... from anon` seul
--  parait reussir et ne ferme rien. On ecrit donc les deux, comme
--  l'impose le §5bis de docs/06-CODING_STANDARDS.md.
--
--  L'event trigger `evt_fonctions_neuves_fermees_a_anon` se declenchera
--  sur le `create or replace` du §1 : c'est voulu, on ne le desarme pas.
--  Il ne retire que l'aclitem PUBLIC, jamais un grant nomme.
--
--  ── 🔴 CE PARAGRAPHE A ETE ECRIT FAUX, ET LE FAUX ETAIT DANGEREUX ────
--  La redaction precedente disait : « AUCUN `grant execute` n'est donne,
--  et ce n'est pas un oubli. Une fonction appelee uniquement depuis une
--  contrainte CHECK n'a besoin d'aucun droit pour l'appelant : le
--  predicat est evalue par le moteur, pas par le role qui insere. »
--
--  C'EST FAUX. Le role qui insere a bien besoin du droit EXECUTE. Le
--  chemin d'appel de PostgreSQL est explicite :
--      ExecRelCheck -> ExecPrepareExpr -> ExecInitExpr -> ExecInitFunc
--  et `ExecInitFunc` appelle `pg_proc_aclcheck(funcid, GetUserId(),
--  ACL_EXECUTE)`. Mesure du verificateur par emprunt de role sur une
--  fonction de meme ACL : `authenticated` -> 42501, `anon` -> 42501,
--  `service_role` -> OK (il detient le grant).
--
--  Le temoin TERRAIN va dans le meme sens, et il est en production :
--  `annonces_marketplace` porte deja
--      CHECK (est_lot_eligible_marketplace(lot_id))
--  et cette fonction est accordee `postgres=X | service_role=X` — soit
--  exactement le role qui ecrit dans la table (sa seule policy
--  d'ecriture est `annonces_mp_service`, role `service_role`).
--  `authenticated` n'y a PAS le droit, et n'y ecrit pas non plus.
--
--  ── CE QUI SAUVAIT LA LIVRAISON, ET QUI N'ETAIT CITE NULLE PART ──────
--  Un defaut de schema, relu en catalogue le 10/08 :
--      pg_default_acl, proprietaire `postgres`, schema `public`, objtype `f` :
--          postgres=X | authenticated=X | service_role=X      (plus d'`anon`)
--  La fonction NAIT donc executable par `authenticated` et
--  `service_role`, et l'effet net du `revoke ... from public, anon`
--  ci-dessous est nul AUJOURD'HUI. Mais c'etait un heureux hasard
--  documente par un raisonnement faux — et le scenario qui mord est
--  simple : quelqu'un relit « aucun droit n'est necessaire », fait
--  `revoke ... from authenticated, service_role`, et TOUTE ecriture dans
--  `documents` tombe en 42501.
--
--  D'ou le `grant execute` EXPLICITE ci-dessous. Un droit explicite ne
--  depend pas d'un defaut de schema qu'une migration future peut changer,
--  et il se lit dans `proacl` comme une intention. C'est exactement ce
--  que fait deja 20260809100000 (lignes 268-269).
--
--  Consequence pour le controle horaire `securite-exposition-anon` : la
--  fonction n'etant accordee a `anon` par aucun chemin, elle n'entre dans
--  aucune des listes de reference de 20260730040000 / 050000. Aucune
--  ligne de base a mettre a jour, le job doit continuer a rendre 0 ecart.
-- ---------------------------------------------------------------------

revoke all on function public.documents_chemin_suit_le_type(public.type_document, text) from public, anon;

-- `authenticated` : les policies `documents_admin_all` et
-- `documents_geometre_plans_insert` ecrivent sous ce role.
-- `service_role` : `generation-document` insere ses lignes avec.
-- Sans ces deux grants, l'evaluation de la contrainte du §4 leve 42501 et
-- AUCUNE ecriture dans `documents` ne passe plus.
grant execute on function public.documents_chemin_suit_le_type(public.type_document, text)
  to authenticated, service_role;


-- ---------------------------------------------------------------------
--  3. GARDE-FOU AVANT ALTER — un `raise exception`, jamais un `warning`
--
--  L'API de management envoie le fichier en UNE requete, donc dans une
--  transaction implicite : une exception ici annule tout, et c'est bien
--  ce qu'on veut. Le `ALTER TABLE ... ADD CONSTRAINT` du §4 leverait de
--  toute facon 23514 si une ligne violait le predicat — mais il ne dirait
--  NI combien, NI lesquelles. Ce bloc le dit.
--
--  🔴 `raise warning` / `raise notice` sont MUETS a travers
--  `scripts/supabase-sql.ps1` : ils n'apparaissent nulle part, et un
--  garde-fou qu'on ne lit pas n'est pas un garde-fou. Tout controle qui
--  compte, dans ce depot, est un `raise exception`.
-- ---------------------------------------------------------------------

do $$
declare
  n_url    bigint;
  n_apercu bigint;
  exemples text;
begin
  select
    count(*) filter (where not public.documents_chemin_suit_le_type(d.type, d.url_fichier)),
    count(*) filter (where d.apercu_url is not null
                       and not public.documents_chemin_suit_le_type(d.type, d.apercu_url))
    into n_url, n_apercu
  from public.documents d;

  if n_url > 0 or n_apercu > 0 then
    select string_agg(format('%s [%s] url=%s apercu=%s',
                             e.id, e.type, e.url_fichier, coalesce(e.apercu_url, '(null)')),
                      E'\n  ')
      into exemples
    from (
      select d2.id, d2.type, d2.url_fichier, d2.apercu_url
      from public.documents d2
      where not public.documents_chemin_suit_le_type(d2.type, d2.url_fichier)
         or (d2.apercu_url is not null
             and not public.documents_chemin_suit_le_type(d2.type, d2.apercu_url))
      limit 20
    ) e;

    raise exception
      'documents_chemin_conforme_au_type NON POSEE : % ligne(s) hors convention sur url_fichier, % sur apercu_url. '
      'La mesure du 10/08/2026 en donnait 0 et 0 sur 179 lignes — les donnees ont donc change depuis, et la table '
      'des prefixes du §1 ne les decrit plus. NE PAS elargir la contrainte pour faire passer : verifier d''abord ce '
      'qui a ecrit ces chemins. Echantillon :%s%s',
      n_url, n_apercu, E'\n  ', exemples;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  4. LA CONTRAINTE — les DEUX colonnes, jamais une seule
--
--  `apercu_url` est traitee `is null or ...` : la colonne est NULL sur
--  178 des 179 lignes, et le rester doit rester licite. Mais des qu'elle
--  porte une valeur, elle subit EXACTEMENT le meme predicat que
--  `url_fichier` — c'est la lecon du 09/08, ou contraindre une colonne
--  sans l'autre n'avait rien ferme du tout.
--
--  `add constraint ... check (...)` sans `not valid` : la contrainte est
--  VALIDEE contre les 179 lignes existantes a l'application. C'est
--  volontaire — un `not valid` laisserait la porte ouverte au passe tout
--  en ayant l'air pose, et sur 179 lignes le cout du scan est nul.
--
--  ⚠️ CE FICHIER N'EST PAS REJOUABLE TEL QUEL : un second passage leve
--  42710 (contrainte deja existante). C'est assume et conforme au reste
--  du depot (cf. §7 de 20260809100000) ; la dette #27 sur
--  `supabase_migrations.schema_migrations` reste la vraie reponse.
-- ---------------------------------------------------------------------

alter table public.documents
  add constraint documents_chemin_conforme_au_type
  check (
    public.documents_chemin_suit_le_type(type, url_fichier)
    and (
      apercu_url is null
      or public.documents_chemin_suit_le_type(type, apercu_url)
    )
  );

comment on constraint documents_chemin_conforme_au_type on public.documents is
  'Dette #49 (10/08/2026) : le chemin de stockage declare par une ligne doit porter le prefixe attendu pour son type, sur url_fichier ET sur apercu_url quand elle est non NULL. Double en base la garde applicative de telecharger-document / convertir-plan-cad, parce qu''une garde applicative se fait rouvrir par une colonne voisine oubliee (constat du 09/08) alors qu''une contrainte de table voit toujours les deux. Mesure avant pose : 0 violation sur 179 lignes.';
