-- =====================================================================
--  DETTE #51 — LE NOM DE FICHIER DOIT ETRE LA REFERENCE DE **SA PROPRE**
--  LIGNE SOURCE, ET SON ANCRAGE CELUI DE CETTE LIGNE-LA
--
--  Enonce d'origine de la dette (§2 du bandeau de tete du document
--  directeur, v1.89), VERBATIM :
--    « La garde verifie que le chemin declare respecte le prefixe attendu
--      pour le type declare ; elle ne verifie pas que l'objet appartient a
--      cette ligne precise, sauf pour plan_lot (seul type ou le dossier =
--      l'id de la ligne). Un role capable d'inserer une ligne documents
--      avec un type et une url_fichier de son choix, sous le bon prefixe,
--      obtiendrait donc une URL signee sur l'objet d'un tiers du meme
--      type. »
--
--  C'est la dette que 20260810100000 (#49) a NOMMEE dans son propre
--  paragraphe « CE QUE CETTE CONTRAINTE NE FAIT PAS », mot pour mot :
--    « Elle n'empeche PAS une ligne de designer le fichier d'une AUTRE
--      ligne du MEME type. […] Fermer cela exigerait de lier url_fichier
--      a la reference de l'acte. »
--  Ce fichier fait exactement cela. Il n'ANNULE ni ne REECRIT #49 : la
--  contrainte `documents_chemin_conforme_au_type` reste en place, telle
--  quelle, et continue de tenir le lien type -> prefixe. Celle-ci tient le
--  lien nom de fichier -> ligne source. Les deux se composent.
--
--  ── DIRECTION TRANCHEE PAR LE PROPRIETAIRE DU PROJET (11/08/2026) ─────
--  Fermer par une CONTRAINTE EN BASE liant `url_fichier` a la reference
--  propre de la ligne source, plutot qu'une garde applicative seule ou une
--  documentation de risque accepte. Meme doctrine que #49 :
--    « une garde applicative se fait rouvrir par une colonne voisine
--      oubliee » — lecon du 09/08 sur `apercu_url`.
--  Ce fichier applique cette lecon a la lettre : `apercu_url` est traitee
--  DES LA PREMIERE REDACTION, pas dans un correctif du lendemain (cf. §1).
--
--
-- ─────────────────────────────────────────────────────────────────────
--  🔴 POURQUOI UN TRIGGER, ET NON UNE CONTRAINTE `CHECK`
-- ─────────────────────────────────────────────────────────────────────
--  DEUX raisons, et la seconde a elle seule suffirait.
--
--  (a) `public.documents` NE PORTE AUCUNE COLONNE vers sa ligne source.
--      Relu en catalogue le 11/08/2026, la table entiere :
--        id, lot_id (nullable), type, titre, emetteur, date_document,
--        url_fichier (NOT NULL), hash_fichier, televerse_le,
--        televerse_par, apercu_url, lotissement_id (nullable),
--        nom_fichier, type_mime, taille_octets
--      Pas de `attestation_cession_id`, pas de `paiement_id`, rien. Le
--      SEUL lien vers la ligne source est le NOM DE FICHIER lui-meme. Le
--      verifier suppose donc d'aller LIRE la table source — et une
--      contrainte CHECK n'accepte que des fonctions IMMUTABLE, c'est-a-dire
--      precisement celles qui ne lisent aucune table (cf. §1 de
--      20260810100000, ou ce point est deja demontre).
--
--  (b) 🔴 LE COUT DE FERMETURE N'EST **PAS** NUL — contrairement a #49.
--      C'est le fait le plus important de ce fichier, et il inverse la
--      conclusion qu'on aurait pu recopier de la veille. MESURE en
--      production le 11/08/2026, predicat du §1 evalue TEL QUEL sur les
--      179 lignes :
--
--        type                              total   conformes   NON conformes
--        attestation_cession                 158        157         1
--        certificat_vente                      2          0         2
--        quittance                            10          0        10
--        pv_bornage                            1          0         1
--        certificat_propriete_coutumiere       6          6         0
--        plan_lot                              2          — hors perimetre —
--        ------------------------------------------------------------------
--        TOTAL                               179        165        14
--
--      Une contrainte CHECK validee echouerait donc en 23514 a
--      l'application, et un `not valid` laisserait la porte ouverte au
--      passe tout en ayant l'air pose (le travers deja refuse au §4 de
--      20260810100000). Un TRIGGER `before insert or update` est le seul
--      outil qui ferme l'AVENIR sans exiger la reecriture du PASSE.
--
--      POURQUOI CES 14 LIGNES SONT NON CONFORMES — cause unique, mesuree,
--      et ce n'est PAS une mauvaise convention de nommage :
--        · `certificats_vente` : 0 ligne en production.
--        · `paiements`         : 0 ligne en production.
--        · `pv_bornage`        : 0 ligne en production.
--        · `missions_geometre` : 0 ligne en production.
--      Les 13 lignes `documents` de ces trois types sont des ORPHELINES :
--      leur ligne source a ete supprimee (remise a zero des attestations,
--      cf. `purge_attestations_remise_a_zero`), le PDF et la ligne de
--      registre sont restes. Le nom de fichier suit la convention a la
--      lettre (`paiements/QUIT-2026-00004.html`, etc.) — il n'y a
--      simplement plus rien en face.
--      La 14e est `attestations_cession/ZZZ-TEST-2026-99999.pdf`
--      (id 4c5669ba-040b-41fb-b924-94bf4942aa8c, lot
--      046362fb-8ed6-48d2-a41d-0e0a13f34c5d) : une ligne de TEST, dont
--      aucune `attestations_cession` ne porte la reference. La meme chaine
--      figure dans `scripts/e2e-dette-49-chemin-signe.mjs:1712` comme
--      VECTEUR DE TEST EN MEMOIRE (le script n'insere aucune ligne) — la
--      ligne de production a donc une autre origine, manuelle.
--
--      ⚠️ CONSEQUENCE OPERATIONNELLE, NOMMEE PLUTOT QUE DECOUVERTE PLUS
--      TARD : ces 14 lignes existantes ne sont PAS reecrites ni
--      supprimees par ce fichier — on ne supprime pas des lignes d'un
--      registre foncier sans decision ligne a ligne (meme arbitrage que le
--      10/08 sur les 57 doublons d'`url_fichier`). Mais elles deviennent
--      INMODIFIABLES SUR LEURS COLONNES STRUCTURANTES : changer leur
--      `url_fichier`, leur `type` ou leur ancrage sera refuse tant que la
--      ligne source n'existe pas. Les modifier sur `titre`, `hash_fichier`,
--      `nom_fichier`… reste possible — c'est tout l'objet du garde de
--      declenchement du §2, qui ne tire QUE si l'une des cinq colonnes
--      structurantes bouge reellement.
--
--
-- ─────────────────────────────────────────────────────────────────────
--  LA TABLE DES ANCRAGES — MESUREE, PAS DEVINEE (11/08/2026)
-- ─────────────────────────────────────────────────────────────────────
--  Sept types portent un prefixe declare par #49. UN SEUL est deja ferme
--  (`plan_lot`, dossier = id de la ligne, garde applicative + `with check`
--  de `documents_geometre_plans_insert`) ; `plan_lotissement` releve d'un
--  autre mecanisme (voir plus bas). Les SIX autres sont adresses PAR
--  REFERENCE, et c'est le perimetre exact de ce fichier :
--
--   type_document                    | table source                  | ancrage
--   ---------------------------------|-------------------------------|--------------------------
--   attestation_cession              | attestations_cession          | s.lot_id       (NOT NULL)
--   certificat_vente                 | certificats_vente             | s.lot_id       (NOT NULL)
--   attestation_attribution          | attestations_attribution_lot  | s.lot_id       (NOT NULL)
--   certificat_propriete_coutumiere  | attestations_coutumieres      | s.lotissement_id (nullable)
--   pv_bornage                       | pv_bornage -> missions_geometre| m.lot_id      (nullable)
--   quittance                        | paiements -> cession/vente/    | lot_id resolu
--                                    |   demarche/attestation_attr.   |   TRANSITIVEMENT
--
--  ⚠️ `attestation_attribution` EST DANS LE PERIMETRE alors que la table
--  `documents` n'en porte AUCUNE ligne aujourd'hui. C'est delibere :
--  `generation-document` l'ecrit (CONFIG, cle
--  `attestations_attribution_lot`), #49 lui a deja declare un prefixe, et
--  c'est l'acte aux enjeux les plus lourds du registre (Niveau 2/3). Ne
--  pas le couvrir laisserait ouvert, sur le type le plus sensible,
--  exactement le trou que ce fichier ferme ailleurs. Cout mesure : 0 ligne.
--
--  ⚠️ `plan_lotissement` N'EST **PAS** COUVERT, et ce n'est pas un oubli.
--  Son chemin est `plans-lotissement/<lotissement_id>/<document_id>.<ext>`
--  (`src/features/lotissements/services/plans.service.ts:114-117`, relu) :
--  il ne designe AUCUNE ligne source externe — il est ancre sur LUI-MEME,
--  comme `plan_lot`. La regle « le nom de fichier est la reference de la
--  ligne source » n'a donc pas de sens pour lui. Fermer `plan_lotissement`
--  demanderait une regle d'une AUTRE forme (dossier = `lotissement_id`,
--  fichier = `id`), du meme genre que celle deja portee par
--  `DOSSIER_EST_L_ID_DE_LA_LIGNE` cote applicatif pour `plan_lot`. C'est
--  une dette distincte, nommee ici, non traitee ici. Elle porte 0 ligne en
--  production au 11/08/2026.
--
--
-- ─────────────────────────────────────────────────────────────────────
--  🔴 D'OU VIENT LE NOM DE FICHIER — DEUX FORMES DANS LE MEME FICHIER
-- ─────────────────────────────────────────────────────────────────────
--  Le mandat de ce chantier signalait une divergence apparente :
--  `generation-document/index.ts:1049` construit
--      `${cfg.type_doc}_${baseVars.reference}.pdf`
--  — donc PREFIXE PAR LE TYPE —, alors que les chemins reellement mesures
--  en production sont `attestations_cession/ATT-CESS-2026-00853.pdf`, SANS
--  prefixe de type. RECONCILIE EN LISANT LE CODE, pas en supposant : ce
--  sont DEUX chaines differentes, dans deux roles differents.
--
--    · ligne 1049  `const filename = ...`  — nom de fichier presente a
--      PDFMonkey / au telechargement. Il ne touche JAMAIS le stockage.
--    · ligne 1152  `const chemin = ${table}/${rec.reference ?? rec.numero
--      ?? rec.id}.${e}` — LA chaine ecrite dans `documents.url_fichier` et
--      passee a `storage.upload()`.
--
--  C'est la SECONDE qui fait foi ici, et elle ne porte aucun prefixe de
--  type. Le repli est bien `reference ?? numero ?? id`, dans cet ordre —
--  transcrit en SQL par `coalesce(reference, numero, id::text)`. Note :
--  `??` de JavaScript ne se replie que sur `null`/`undefined`, jamais sur
--  la chaine vide ; `coalesce` ne se replie que sur NULL. Les deux
--  coincident. Une colonne ABSENTE de la table rend `undefined` cote JS et
--  se replie donc aussi — c'est pourquoi le SQL n'ecrit `numero` QUE pour
--  `attestations_coutumieres`, SEULE des six tables sources a porter cette
--  colonne (mesure en catalogue, 11/08).
--
--
-- ─────────────────────────────────────────────────────────────────────
--  🔴 CE QUE VAUT `documents.lot_id` COMME ANCRAGE — RELU, PAS SUPPOSE
-- ─────────────────────────────────────────────────────────────────────
--  Question posee avant d'ecrire : peut-on FAIRE CONFIANCE a `lot_id` /
--  `lotissement_id` de la ligne en cours d'ecriture ? Les policies
--  d'ECRITURE de `documents` ont ete relues en catalogue (`pg_policies`,
--  11/08/2026). Il y en a DEUX, et une seule hors admin :
--
--   (a) `documents_admin_all` — cmd ALL, roles {public},
--       using/with_check = `est_admin()`. Un admin ecrit ce qu'il veut,
--       AVEC LE `lot_id` QU'IL VEUT. Cas peu interessant en soi (l'admin
--       lit deja tout), mais il montre que la colonne n'est contrainte par
--       RIEN.
--
--   (b) `documents_geometre_plans_insert` — cmd INSERT, {authenticated}.
--       Son `with check` impose `mon_groupe() = 'geometre'`,
--       `type = 'plan_lot'`, `televerse_par = auth.uid()`,
--       `url_fichier like 'plans-cad/' || id || '/%'`, `apercu_url IS NULL`
--       et `lotissement_id IS NULL`.
--       🔴 IL NE CONTRAINT **PAS** `lot_id`. Un geometre peut donc, des
--       aujourd'hui, inserer une ligne `plan_lot` en declarant le `lot_id`
--       d'un tiers. Cela ne lui ouvre AUCUN fichier (le chemin reste
--       borne a `plans-cad/<son propre id>/`), mais cela etablit le fait
--       qui compte ici : **`documents.lot_id` est une DECLARATION DE
--       L'ECRIVAIN, pas une verite verifiee.**
--
--  CONCLUSION, et c'est le coeur du raisonnement de ce fichier :
--  l'ancrage n'est PAS verifie parce qu'on croirait `lot_id` ; il est
--  verifie parce qu'il rend les DEUX conditions de l'attaque
--  CONTRADICTOIRES. Pour exploiter #51 il faut :
--    ① ECRIRE une ligne dont `url_fichier` designe l'acte d'un tiers ;
--    ② POUVOIR LA RELIRE — `telecharger-document` relit la ligne avec le
--       jeton de l'appelant, donc sous RLS (mecanisme etabli par #49).
--  Or les policies SELECT de `documents` (relues le 11/08 : `documents_read`,
--  `documents_lot_parties_read`, `documents_lotissement_read`,
--  `documents_geometre_plans_read`) n'accordent la lecture QUE par
--  `lot_id` ou `lotissement_id`. Pour relire sa ligne forgee, l'attaquant
--  doit donc y declarer SON lot ; et ce fichier exige qu'elle porte LE LOT
--  DE LA LIGNE SOURCE. Les deux exigences ne peuvent etre satisfaites
--  ensemble que si l'acte lui appartient vraiment.
--
--  Ce raisonnement n'est pas neuf dans ce depot : il est deja CABLE dans
--  `est_signataire_acte_du_lot(uuid, text)` (relue integralement le
--  11/08), qui exige simultanement `ac.lot_id = p_lot_id` ET
--  `ac.reference = <segment du nom de fichier>`. Ce fichier applique du
--  cote ECRITURE la regle que cette fonction applique deja du cote
--  LECTURE, pour les six types au lieu d'un.
--
--
-- ─────────────────────────────────────────────────────────────────────
--  LA REGLE, TYPE PAR TYPE — ET CE QU'ELLE FERME VRAIMENT
-- ─────────────────────────────────────────────────────────────────────
--  DEUX classes, parce que les ecrivains legitimes ne se comportent pas de
--  la meme facon. `generation-document` ecrit toujours
--  `lot_id: rec.lot_id ?? null` (ligne 1251) et n'ecrit JAMAIS
--  `lotissement_id`. Ce que la ligne source porte decide donc de ce que la
--  ligne `documents` portera :
--
--  ── CLASSE A — FERMETURE COMPLETE ────────────────────────────────────
--    `attestation_cession`, `certificat_vente`, `attestation_attribution`
--    Leur table source a `lot_id NOT NULL` (mesure en catalogue), donc la
--    ligne `documents` porte TOUJOURS un `lot_id` (mesure sur les donnees :
--    158/158 et 2/2 non NULL). La regle est donc STRICTE :
--        lot_id NOT NULL  ET  lot_id = source.lot_id  ET  lotissement_id NULL
--    L'echappatoire « je mets lot_id a NULL pour ne pas etre confronte »
--    est FERMEE pour ces trois types.
--
--  ── CLASSE B — FERMETURE REELLE MAIS CONDITIONNELLE ──────────────────
--    `certificat_propriete_coutumiere`, `quittance`, `pv_bornage`
--    Leur table source n'a pas de `lot_id` propre (mesure : ni `paiements`,
--    ni `pv_bornage`, ni `attestations_coutumieres` n'en portent), donc
--    l'ecrivain legitime laisse `documents.lot_id` a NULL — 10/10, 1/1 et
--    6/6 mesures a NULL. On ne peut donc PAS exiger un ancrage non NULL
--    sans casser la generation. La regle est :
--        (lot_id IS NULL ou lot_id = ancrage resolu de la ligne source)
--        (lotissement_id IS NULL ou = source.lotissement_id)
--    Ce qui reste ferme malgre le NULL : une ligne forgee a `lot_id` NULL
--    **et** `lotissement_id` NULL n'est lisible par AUCUNE des quatre
--    policies SELECT de `documents` — `documents_read` exige
--    `attributions.lot_id = documents.lot_id` (faux si NULL) ou
--    `est_signataire_acte_du_lot(lot_id, …)`, qui commence par
--    `p_lot_id is not null` (relu, 11/08) ; les trois autres exigent
--    explicitement `lot_id IS NOT NULL` ou `lotissement_id IS NOT NULL`.
--    L'attaquant obtient donc une ligne qu'il ne peut pas relire, et
--    `telecharger-document` ne signera jamais rien pour lui.
--
--    🔴 MAIS CE DERNIER POINT NE TIENT PAS A CE FICHIER — il tient aux
--    policies SELECT DU JOUR. Le jour ou une policy accordera la lecture
--    par un autre chemin que l'ancrage (le candidat evident :
--    `televerse_par = auth.uid()`), l'echappatoire NULL de la classe B
--    s'ouvrira, et la fermeture de ces trois types redeviendra partielle.
--    C'est la DETTE RESIDUELLE de ce fichier, et la voie de fond est
--    connue : faire porter `lotissement_id` par `generation-document` pour
--    l'APFC, et un `lot_id` resolu pour la quittance et le PV — apres quoi
--    la classe B pourra rejoindre la classe A par une seconde migration.
--    Ce fichier prepare deja ce jour-la : la regle accepte `lot_id`/
--    `lotissement_id` NON NULL des lors qu'ils sont JUSTES, donc le
--    correctif applicatif pourra etre livre SANS toucher a cette base.
--
--  ── `apercu_url` — TRAITEE ICI, PAS DEMAIN ───────────────────────────
--  Pour les six types du perimetre, `apercu_url` doit etre NULL. Aucun
--  ecrivain n'en pose (mesure : UNE SEULE ligne non NULL sur 179, et c'est
--  un `plan_lot` : `plans-cad/…/apercu.png`). C'est l'application directe
--  du 09/08 : `telecharger-document` choisit la colonne a signer selon un
--  `variant` FOURNI PAR LE CLIENT — une regle qui ne parlerait que de
--  `url_fichier` serait donc contournee par la colonne voisine, exactement
--  comme la premiere correction de #49 l'a ete.
--
--
-- ─────────────────────────────────────────────────────────────────────
--  CE QUE CE FICHIER NE FAIT PAS
-- ─────────────────────────────────────────────────────────────────────
--   · Il ne remplace NI #49 (`documents_chemin_conforme_au_type`, laissee
--     intacte, non recreee) NI la garde applicative des trois edge
--     functions. Il ajoute une troisieme barriere, orthogonale.
--   · Il ne ferme PAS `plan_lotissement` (mecanisme d'ancrage different,
--     voir plus haut) ni `plan_lot` (deja ferme, explicitement laisse hors
--     perimetre par le mandat).
--   · Il ne ferme pas l'ORACLE D'EXISTENCE : un ecrivain autorise peut
--     distinguer « aucune ligne source ne porte cette reference » de
--     « l'ancrage ne correspond pas », donc tester l'existence d'une
--     reference. Assume et borne : le motif de refus NE REVELE JAMAIS le
--     `lot_id` attendu (c'est le secret qui aurait de la valeur), et les
--     references sont de toute facon sequentielles donc enumerables. Ce
--     choix est la raison pour laquelle `motif_de_refus_de_l_ancrage` n'est
--     accordee NI a `anon` NI a `authenticated` (§3).
--   · Il ne borne ni la taille ni le type MIME du binaire — reglage de
--     bucket, pas contrainte de table (constat du 29/07, inchange).
--   · Il ne repare AUCUNE des 14 lignes non conformes. Elles restent
--     telles quelles, et le §4 les cite nommement pour qu'une 15e ne
--     puisse pas se glisser parmi elles sans faire echouer ce fichier.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LE PREDICAT, EN UNE SEULE FONCTION
--
--  Ecrite une fois et appelee TROIS fois — le garde-fou de mesure (§4), le
--  trigger (§2) et la verification finale (§6) — plutot que recopiee.
--  Meme raison qu'au §1 de 20260810100000 : une regle de securite recopiee
--  a la main diverge, et ce depot en a la preuve datee.
--
--  Elle rend NULL quand tout va bien, et sinon un MOTIF qui nomme la
--  cause — meme convention que `motifDeRefusDuChemin` cote edge functions.
--  Un motif faux coute une heure d'enquete ; un motif absent en coute
--  plusieurs.
--
--  ── `stable`, ET **PAS** `security definer` ──────────────────────────
--  `stable` parce qu'elle LIT des tables : `immutable` serait une
--  declaration de complaisance, exactement ce que le §1 de 20260810100000
--  s'interdisait. C'est aussi pourquoi elle ne peut pas porter une CHECK.
--
--  Pas de `security definer` : elle n'en a pas besoin. Son SEUL appelant
--  en production est la fonction trigger du §2, qui est `security definer`
--  et sous laquelle `GetUserId()` vaut deja `postgres` — la RLS des tables
--  sources y est donc deja contournee. Un `security definer` de plus
--  serait une surface offerte pour rien (meme arbitrage qu'au §1 de
--  20260810100000).
--
--  ── UNE SEULE REQUETE, ET ELLE RESISTE AUX DOUBLONS ──────────────────
--  Le `union all` filtre par `p_type` remplace six `case ... when` : il
--  compte a la fois les lignes sources qui portent la reference ET celles
--  dont l'ancrage concorde. Un `select ... limit 1` aurait choisi UNE
--  ligne au hasard parmi d'eventuels homonymes et aurait pu refuser une
--  ecriture legitime. Mesure du 11/08 : 0 doublon de reference sur
--  `attestations_cession`, `certificats_vente`, `paiements`, `pv_bornage` —
--  la robustesse est donc gratuite aujourd'hui, et acquise pour demain.
-- ---------------------------------------------------------------------

create or replace function public.motif_de_refus_de_l_ancrage(
  p_type            public.type_document,
  p_url_fichier     text,
  p_apercu_url      text,
  p_lot_id          uuid,
  p_lotissement_id  uuid
)
returns text
language plpgsql
stable
set search_path to pg_catalog, public
as $function$
declare
  v_base      text;
  v_n_ref     bigint;   -- lignes sources portant cette reference
  v_n_ancre   bigint;   -- ... dont l'ancrage concorde avec la ligne ecrite
begin
  -- ── PERIMETRE : liste BLANCHE POSITIVE, et `else NULL` (fail-open) ──
  -- ⚠️ ASYMETRIE VOLONTAIRE AVEC #49, qui fait `else false` (fail-closed).
  -- La regle de #49 est UNIVERSELLE (tout type a un prefixe ou n'est
  -- ecrivable nulle part). Celle-ci ne vaut QUE pour les types adresses
  -- par la reference d'une ligne source externe. Un `else` fermant
  -- rendrait `plan_lot` et `plan_lotissement` — ancres sur eux-memes —
  -- inserables nulle part, ce qui casserait le module geometre en
  -- production pour un gain de securite nul. Le fail-closed du TYPE est
  -- deja tenu, une fois, par `documents_chemin_conforme_au_type`.
  if p_type not in (
       'attestation_cession'::public.type_document,
       'certificat_vente'::public.type_document,
       'attestation_attribution'::public.type_document,
       'certificat_propriete_coutumiere'::public.type_document,
       'pv_bornage'::public.type_document,
       'quittance'::public.type_document
     ) then
    return null;
  end if;

  -- ── LA COLONNE VOISINE, D'EMBLEE (lecon du 09/08) ──────────────────
  if p_apercu_url is not null then
    return format(
      'apercu_url renseignee pour le type %s : aucun ecrivain n''en pose pour ce type, '
      'et telecharger-document choisit la colonne a signer selon un variant fourni par le CLIENT',
      p_type);
  end if;

  -- Dernier segment du chemin, extension retiree — MEME extraction que
  -- `est_signataire_acte_du_lot` (relue le 11/08) et que la garde
  -- applicative : `regexp_replace(…, '^.*/', '')` puis retrait du suffixe.
  v_base := regexp_replace(
              regexp_replace(coalesce(p_url_fichier, ''), '^.*/', ''),
              '\.[^.]*$', '');
  if v_base is null or v_base = '' then
    return format('nom de fichier vide dans url_fichier %L', p_url_fichier);
  end if;

  -- ── CLASSE A : l'echappatoire NULL est fermee ───────────────────────
  -- Les trois tables sources ont `lot_id NOT NULL` (catalogue, 11/08) et
  -- generation-document recopie donc TOUJOURS un lot. Accepter NULL ici
  -- offrirait a l'attaquant une ligne echappant a la confrontation — au
  -- prix, il est vrai, d'une ligne qu'il ne saurait pas relire aujourd'hui.
  -- On ne s'appuie pas sur « aujourd'hui » quand on peut refuser.
  if p_lot_id is null
     and p_type in (
       'attestation_cession'::public.type_document,
       'certificat_vente'::public.type_document,
       'attestation_attribution'::public.type_document) then
    return format(
      'lot_id absent pour le type %s, dont la table source porte lot_id NOT NULL '
      '(une ligne sans ancrage ne peut etre confrontee a sa ligne source)', p_type);
  end if;

  select
    count(*),
    count(*) filter (
      where (p_lot_id is null         or p_lot_id         = s.lot_src)
        and (p_lotissement_id is null or p_lotissement_id = s.lotm_src))
    into v_n_ref, v_n_ancre
  from (
    -- attestation_cession -> attestations_cession.lot_id
    select a.lot_id as lot_src, null::uuid as lotm_src
      from public.attestations_cession a
     where p_type = 'attestation_cession'::public.type_document
       and coalesce(a.reference, a.id::text) = v_base

    union all
    -- certificat_vente -> certificats_vente.lot_id
    select c.lot_id, null::uuid
      from public.certificats_vente c
     where p_type = 'certificat_vente'::public.type_document
       and coalesce(c.reference, c.id::text) = v_base

    union all
    -- attestation_attribution -> attestations_attribution_lot.lot_id
    select t.lot_id, null::uuid
      from public.attestations_attribution_lot t
     where p_type = 'attestation_attribution'::public.type_document
       and coalesce(t.reference, t.id::text) = v_base

    union all
    -- certificat_propriete_coutumiere -> attestations_coutumieres.lotissement_id
    -- ⚠️ SEULE des six tables a porter `numero` : le repli `reference ??
    -- numero ?? id` de generation-document:1152 n'a de sens QUE pour elle.
    -- ⚠️ ANCRAGE = lotissement_id, PAS lot_id : l'APFC est un document DE
    -- LOTISSEMENT, pas d'un lot (constat deja pose dans le depot pour le
    -- Passeport parcelle). `lot_src` reste donc NULL, ce qui IMPOSE
    -- `documents.lot_id IS NULL` — conforme aux 6 lignes mesurees.
    select null::uuid, k.lotissement_id
      from public.attestations_coutumieres k
     where p_type = 'certificat_propriete_coutumiere'::public.type_document
       and coalesce(k.reference, k.numero, k.id::text) = v_base

    union all
    -- pv_bornage -> missions_geometre.lot_id (un saut)
    -- `left join` volontaire : un PV dont la mission ne vise aucun lot
    -- reste identifiable par sa reference, et son `lot_src` NULL impose
    -- alors `documents.lot_id IS NULL` — fail-closed sans faire disparaitre
    -- la ligne source.
    select m.lot_id, null::uuid
      from public.pv_bornage b
      left join public.missions_geometre m on m.id = b.mission_id
     where p_type = 'pv_bornage'::public.type_document
       and coalesce(b.reference, b.id::text) = v_base

    union all
    -- quittance -> paiements -> (cession | vente | demarche | attestation
    -- d'attribution) -> lot_id. `paiements` ne porte NI lot_id NI
    -- lotissement_id (schema complet relu le 11/08) ; ces quatre colonnes
    -- sont les SEULES qui menent a un lot, et elles sont toutes nullables.
    -- L'ordre du coalesce va du lien le plus specifique au plus general.
    -- Alias `q` et non `p` : les parametres de cette fonction sont tous
    -- prefixes `p_`, et un alias de table `p` dans le meme corps plpgsql
    -- invite la confusion au premier lecteur comme au premier correctif.
    select coalesce(ce.lot_id, ve.lot_id, de.lot_id, aa.lot_id), null::uuid
      from public.paiements q
      left join public.cessions   ce on ce.id = q.cession_id
      left join public.ventes     ve on ve.id = q.vente_id
      left join public.demarches  de on de.id = q.demarche_id
      left join public.attestations_attribution_lot aa on aa.id = q.attestation_attribution_id
     where p_type = 'quittance'::public.type_document
       and coalesce(q.reference, q.id::text) = v_base
  ) s;

  if v_n_ref = 0 then
    return format(
      'aucune ligne source du type %s ne porte la reference %L '
      '(nom de fichier extrait de url_fichier %L)', p_type, v_base, p_url_fichier);
  end if;

  if v_n_ancre = 0 then
    -- 🔴 LE MOTIF NE NOMME PAS LE LOT ATTENDU, ET C'EST DELIBERE : le
    -- reveler ferait de ce refus un oracle sur la carte
    -- reference -> lot, enumerable sur 898 lots. L'ecrivain connait deja
    -- la reference et le lot qu'il a declares ; il n'a pas besoin de
    -- l'autre.
    return format(
      'ancrage divergent : la ligne source %L existe, mais lot_id=%L / lotissement_id=%L '
      'ne sont pas les siens (dette #51 — un document ne peut designer le fichier d''un tiers)',
      v_base, p_lot_id, p_lotissement_id);
  end if;

  return null;
end;
$function$;


-- ---------------------------------------------------------------------
--  2. LA FONCTION TRIGGER
--
--  ── POURQUOI `security definer` ICI (et pas au §1) ──────────────────
--  Le trigger doit LIRE les six tables sources (et les quatre tables
--  relais de la quittance) au nom de N'IMPORTE QUEL ecrivain. Sans
--  `security definer`, la RLS de `attestations_cession` &co s'appliquerait
--  a l'ECRIVAIN : une ligne source parfaitement legitime mais invisible
--  pour lui rendrait `v_n_ref = 0`, et la garde produirait un FAUX ROUGE —
--  un refus d'ecriture legitime, la panne la plus couteuse qu'une garde
--  puisse causer. Le proprietaire de la fonction est `postgres`
--  (proprietaire de `documents`, mesure), qui contourne la RLS.
--  `set search_path` est pose : un `security definer` sans search_path fixe
--  est une escalade en attente.
--
--  ── LE GARDE DE DECLENCHEMENT — CE QUI EVITE DE BRIQUER 14 LIGNES ────
--  Sur UPDATE, la garde ne tire QUE si l'une des cinq colonnes
--  structurantes change reellement (`is distinct from` — jamais `<>`, qui
--  vaut NULL des qu'un cote est NULL et laisserait donc passer toute
--  transition vers ou depuis NULL sans la voir).
--  Raison mesuree : 14 lignes existantes violent le predicat parce que
--  leur table source a ete videe. Sans ce garde, un simple `update
--  documents set titre = …` sur une quittance de 2026 serait refuse — une
--  panne operationnelle pour un gain de securite NUL, puisque rien de
--  repointable n'a bouge. Et la fermeture reste entiere : toute tentative
--  de faire designer un autre objet PASSE FORCEMENT par `url_fichier`,
--  `apercu_url` ou `type` ; toute tentative de rendre la ligne lisible
--  passe par `lot_id` ou `lotissement_id`. Les cinq sont surveillees.
--
--  ── `23514` PLUTOT QUE `P0001` ──────────────────────────────────────
--  Le refus est de meme NATURE que celui de `documents_chemin_conforme_au_type`
--  (violation d'integrite), et le client — PostgREST — doit le rendre
--  identiquement (400). `P0001` est reserve, dans ce depot, aux refus
--  METIER (cf. le couple P0001/25006 du maker-checker C1).
-- ---------------------------------------------------------------------

create or replace function public.documents_ancrage_avant_ecriture()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public
as $function$
declare
  v_motif text;
begin
  -- 🔴 LE `if` IMBRIQUE N'EST PAS UN STYLE, C'EST UNE OBLIGATION.
  -- Ecrit d'un seul tenant — `tg_op = 'UPDATE' and new.type is not distinct
  -- from old.type and …` — ce test CASSE TOUTE INSERTION : `OLD` est
  -- UNASSIGNED dans un trigger INSERT (« record "old" is not assigned yet »,
  -- la structure d'un record non assigne est indeterminee), et `AND` de SQL
  -- ne garantit AUCUN court-circuit gauche-droite — le planificateur est
  -- libre d'evaluer `old.type` en premier. La panne aurait ete totale et
  -- immediate : plus une seule ligne `documents` inserable, donc plus une
  -- seule attestation deposee. Le `tg_op` doit donc etre tranche par un
  -- BRANCHEMENT, pas par un operande.
  if tg_op = 'UPDATE' then
    if new.type           is not distinct from old.type
       and new.url_fichier    is not distinct from old.url_fichier
       and new.apercu_url     is not distinct from old.apercu_url
       and new.lot_id         is not distinct from old.lot_id
       and new.lotissement_id is not distinct from old.lotissement_id then
      return new;
    end if;
  end if;

  v_motif := public.motif_de_refus_de_l_ancrage(
               new.type, new.url_fichier, new.apercu_url,
               new.lot_id, new.lotissement_id);

  if v_motif is not null then
    raise exception using
      errcode = '23514',
      message = format('documents : ancrage refuse (dette #51) — %s', v_motif),
      detail  = format('id=%L type=%s url_fichier=%L apercu_url=%L lot_id=%L lotissement_id=%L operation=%s',
                       new.id, new.type, new.url_fichier, new.apercu_url,
                       new.lot_id, new.lotissement_id, tg_op),
      hint    = 'Le nom de fichier (dernier segment, sans extension) doit etre la reference '
                '(ou a defaut le numero, ou a defaut l''id) de SA PROPRE ligne source, et '
                'lot_id/lotissement_id doivent etre ceux de cette ligne-la. Voir '
                'supabase/migrations/20260811120000_documents_reference_correspond_a_sa_ligne.sql.';
  end if;

  return new;
end;
$function$;


-- ---------------------------------------------------------------------
--  3. ACL — le defaut d'execution de ce projet est CABLE vers PUBLIC
--
--  PostgreSQL accorde EXECUTE a PUBLIC sur toute fonction neuve, par un
--  defaut cable en dur qui ne se voit qu'en lisant `proacl is null` ;
--  `revoke ... from anon` seul parait reussir et ne ferme rien. On ecrit
--  donc les deux, comme l'impose le §5bis de docs/06-CODING_STANDARDS.md.
--  L'event trigger `evt_fonctions_neuves_fermees_a_anon` se declenchera sur
--  les `create or replace` ci-dessus : c'est voulu, on ne le desarme pas.
--
--  ⚠️ MESURE DU 11/08 QUI JUSTIFIE DE NE PAS S'EN REMETTRE AU DEFAUT DE
--  SCHEMA : `pg_default_acl` de `public`, objtype `f`, porte DEUX entrees —
--    proprietaire `postgres`        : postgres=X | authenticated=X | service_role=X
--    proprietaire `supabase_admin`  : postgres=X | anon=X | authenticated=X | service_role=X
--  La seconde NOMME `anon`. Une fonction creee sous ce proprietaire-la
--  naitrait donc executable par `anon`. Le `revoke` ci-dessous n'est pas
--  decoratif.
--
--  ── CE QUI EST ACCORDE, ET CE QUI NE L'EST PAS ──────────────────────
--   · `motif_de_refus_de_l_ancrage` : accordee au SEUL `service_role`.
--     PAS a `authenticated`, et c'est un choix de securite, pas un oubli :
--     appelable directement, elle devient un ORACLE sur la carte
--     reference -> lot (« ce lot est-il celui de ATT-CESS-2026-00846 ? »),
--     enumerable sur 898 lots. Elle n'a besoin d'aucun grant pour le
--     chemin qui compte : son appelant est la fonction du §2, qui est
--     `security definer` et sous laquelle `GetUserId()` vaut `postgres`.
--     `service_role` la garde pour le diagnostic — il contourne deja la
--     RLS, l'oracle ne lui apprend rien.
--
--   · `documents_ancrage_avant_ecriture` : accordee a `authenticated` et
--     `service_role`. PostgreSQL controle EXECUTE sur une fonction trigger
--     au moment du `CREATE TRIGGER`, pas a chaque declenchement — mais ce
--     depot a DEJA paye une fois le prix d'un raisonnement confiant sur
--     ce point precis (§2 de 20260810100000 : « le predicat est evalue par
--     le moteur, pas par le role qui insere » — c'etait FAUX pour les
--     CHECK, et il a fallu un emprunt de role pour le voir). Le grant
--     explicite rend la question sans objet et ne coute rien : une
--     fonction trigger appelee hors trigger echoue de toute facon en
--     « trigger functions can only be called as triggers » (0A000).
-- ---------------------------------------------------------------------

revoke all on function public.motif_de_refus_de_l_ancrage(
  public.type_document, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.motif_de_refus_de_l_ancrage(
  public.type_document, text, text, uuid, uuid) to service_role;

revoke all on function public.documents_ancrage_avant_ecriture() from public, anon;
grant execute on function public.documents_ancrage_avant_ecriture() to authenticated, service_role;


-- ---------------------------------------------------------------------
--  4. GARDE-FOU AVANT POSE — un `raise exception`, jamais un `warning`
--
--  🔴 `raise warning` / `raise notice` sont MUETS a travers
--  `scripts/supabase-sql.ps1` : un garde-fou qu'on ne lit pas n'est pas un
--  garde-fou. Tout controle qui compte, dans ce depot, est un
--  `raise exception`.
--
--  ── POURQUOI CE BLOC N'EST **PAS** CELUI DE 20260810100000 ───────────
--  Celui du 10/08 echouait des que le compte de violations depassait ZERO,
--  parce que la contrainte allait etre VALIDEE contre l'existant. Ici le
--  compte mesure vaut QUATORZE, et un trigger ne retro-valide rien :
--  recopier `if n > 0 then raise` rendrait cette migration inapplicable,
--  et l'ajuster a `if n > 14` accepterait qu'une 15e ligne remplace
--  silencieusement une des 14 (le compte serait le meme).
--
--  Le controle porte donc sur L'IDENTITE des lignes, pas sur leur nombre :
--  chaque ligne non conforme doit etre l'une des 14 MESUREES NOMMEMENT le
--  11/08/2026. Une nouvelle fait echouer le fichier ; une reparation (une
--  table source repeuplee) le laisse passer, ce qui est le sens correct de
--  la tolerance.
-- ---------------------------------------------------------------------

do $$
declare
  -- Les 14 lignes non conformes MESUREES en production le 11/08/2026,
  -- lecture seule. 13 orphelines (source videe) + 1 ligne de test.
  c_heritees constant uuid[] := array[
    -- certificat_vente (2) — `certificats_vente` porte 0 ligne
    '4445a3b5-a71a-43cc-97ef-edf029aa091c',  -- certificats_vente/CERT-VENTE-2026-00044.pdf
    '31321bd5-31cc-4510-8ead-ba28cc9ed50c',  -- certificats_vente/CERT-VENTE-2026-00045.pdf
    -- quittance (10) — `paiements` porte 0 ligne
    '028bf116-b5f0-4bae-9703-f5aacbafb3aa',  -- paiements/QUIT-2026-00004.html
    '3db8ba80-83c6-4954-88f4-68c6902dd593',  -- paiements/QUIT-2026-00005.html
    '70186899-5475-4e5b-8809-74301718a08f',  -- paiements/QUIT-2026-00006.html
    '6cbf7df6-57ba-48e4-a749-83cfd576dfb2',  -- paiements/QUIT-2026-00007.html
    '8049fd77-2bf9-4097-9c69-169a3db8d0fe',  -- paiements/QUIT-2026-00007.html (doublon)
    'da0354ab-d30f-42e5-9468-9f832786e5e0',  -- paiements/QUIT-2026-00008.html
    'af9aaf3f-ec04-48cf-9adc-ab2f6c21fa6f',  -- paiements/QUIT-2026-00009.html
    '0f7fcb8f-a8ac-42c8-ae5d-9d38baa56022',  -- paiements/QUIT-2026-00010.html
    'da3abdf7-2bf7-42f8-bb6d-ebc405ee2a2b',  -- paiements/QUIT-2026-00011.html
    '23449c2f-f2bd-4a7d-a8ff-fa455b4e1af6',  -- paiements/QUIT-2026-00014.pdf
    -- pv_bornage (1) — `pv_bornage` porte 0 ligne
    'b2d437da-9e6f-4d6c-8a92-778339a8f892',  -- pv_bornage/PV-BORNAGE-2026-00005.html
    -- attestation_cession (1) — ligne de TEST, reference inexistante
    '4c5669ba-040b-41fb-b924-94bf4942aa8c'   -- attestations_cession/ZZZ-TEST-2026-99999.pdf
  ]::uuid[];  -- cast EXPLICITE : un constructeur `array[…]` de litteraux non
              -- types se resout en text[], et l'on ne s'en remet pas a la
              -- conversion d'affectation de plpgsql pour un tableau.

  n_total     bigint;
  n_violantes bigint;
  n_nouvelles bigint;
  exemples    text;
begin
  select count(*),
         count(*) filter (where public.motif_de_refus_de_l_ancrage(
                                  d.type, d.url_fichier, d.apercu_url,
                                  d.lot_id, d.lotissement_id) is not null)
    into n_total, n_violantes
  from public.documents d;

  select count(*) into n_nouvelles
  from public.documents d
  where public.motif_de_refus_de_l_ancrage(
          d.type, d.url_fichier, d.apercu_url, d.lot_id, d.lotissement_id) is not null
    and d.id <> all (c_heritees);

  if n_nouvelles > 0 then
    select string_agg(format('%s [%s] url=%s lot=%s -> %s',
                             e.id, e.type, e.url_fichier, coalesce(e.lot_id::text, '(null)'),
                             public.motif_de_refus_de_l_ancrage(e.type, e.url_fichier,
                               e.apercu_url, e.lot_id, e.lotissement_id)),
                      E'\n  ')
      into exemples
    from (
      select d2.* from public.documents d2
      where public.motif_de_refus_de_l_ancrage(
              d2.type, d2.url_fichier, d2.apercu_url, d2.lot_id, d2.lotissement_id) is not null
        and d2.id <> all (c_heritees)
      limit 20
    ) e;

    -- ⚠️ `raise` ne connait QUE `%` comme substitution, et `%%` comme un `%`
    -- LITTERAL : ni `%s` ni `%L` n'y ont le sens qu'ils ont dans `format()`.
    -- 20260810100000 (§3) en porte la trace — « Echantillon :%s%s » y imprime
    -- deux `s` parasites. Ici les deux dernieres valeurs sont concatenees en
    -- UN seul argument plutot que juxtaposees : deux `%` colles ne se
    -- distinguent pas d'un `%%`.
    raise exception
      'trg_documents_ancrage NON POSE : % ligne(s) non conforme(s) NE FIGURENT PAS parmi les 14 heritees '
      'mesurees le 11/08/2026 (total non conformes : % sur % lignes). Les donnees ont donc change depuis, '
      'et l''analyse du bandeau de tete ne les decrit plus. NE PAS ajouter ces ids a la liste pour faire '
      'passer : verifier d''abord CE QUI a ecrit ces lignes, et si leur ligne source existe. Echantillon :%',
      n_nouvelles, n_violantes, n_total, E'\n  ' || exemples;
  end if;

  -- Contre-epreuve : le predicat doit AUSSI dire oui quelque part, sans
  -- quoi un predicat casse (qui refuserait tout) passerait ce controle
  -- dans l'autre sens. 165 lignes conformes mesurees le 11/08.
  if n_total - n_violantes < 160 then
    raise exception
      'Predicat SUSPECT : seulement % ligne(s) conforme(s) sur % (165 mesurees le 11/08/2026). '
      'Un predicat qui refuse presque tout passerait le controle ci-dessus sans rien fermer.',
      n_total - n_violantes, n_total;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  5. LE TRIGGER
--
--  `before insert or update` : BEFORE, pour refuser AVANT toute ecriture,
--  et `for each row`, la regle portant sur chaque ligne.
--
--  `drop trigger if exists` d'abord : ce fichier est ainsi REJOUABLE sur
--  sa partie trigger, contrairement a 20260810100000 qui leve 42710 au
--  second passage (§4 de ce fichier, assume a l'epoque). Rien n'obligeait
--  a reproduire cette gene.
--
--  ⚠️ Un trigger n'est PAS contourne par `service_role` : contrairement a
--  la RLS, il s'applique a tout le monde, y compris a
--  `generation-document`. C'est voulu — c'est justement l'ecrivain le plus
--  puissant, celui dont personne ne relit les chemins.
-- ---------------------------------------------------------------------

drop trigger if exists trg_documents_ancrage on public.documents;

create trigger trg_documents_ancrage
  before insert or update on public.documents
  for each row
  execute function public.documents_ancrage_avant_ecriture();


comment on function public.motif_de_refus_de_l_ancrage(
  public.type_document, text, text, uuid, uuid) is
  'Rend NULL si la ligne documents proposee est correctement ancree, sinon un motif nommant la cause. Le dernier segment de url_fichier (extension retiree) doit etre la reference — ou a defaut le numero, ou a defaut l''id, meme repli que generation-document/index.ts:1152 — d''une ligne des 6 tables sources adressees par reference, et lot_id/lotissement_id doivent etre ceux de CETTE ligne-la. Porte le trigger trg_documents_ancrage (dette #51, 11/08/2026). Hors perimetre (rend NULL) : plan_lot, deja ferme par dossier=id, et plan_lotissement, ancre sur lui-meme — asymetrie VOULUE avec le else-false de documents_chemin_suit_le_type. Non accordee a authenticated : appelable directement, elle serait un oracle sur la carte reference->lot.';

comment on function public.documents_ancrage_avant_ecriture() is
  'Fonction du trigger trg_documents_ancrage (dette #51, 11/08/2026). SECURITY DEFINER pour lire les tables sources sans la RLS de l''ecrivain — sans quoi une ligne source legitime mais invisible pour lui produirait un FAUX ROUGE. Sur UPDATE, ne tire que si type, url_fichier, apercu_url, lot_id ou lotissement_id change reellement (is distinct from) : 14 lignes heritees violent le predicat parce que leur table source a ete videe, et doivent rester modifiables sur leurs colonnes non structurantes. Leve 23514, comme la contrainte documents_chemin_conforme_au_type dont elle est le complement.';

comment on trigger trg_documents_ancrage on public.documents is
  'Dette #51 (11/08/2026) : le nom de fichier declare par une ligne doit etre la reference de SA PROPRE ligne source, et son ancrage lot/lotissement celui de cette ligne. Complete — sans la remplacer — la contrainte documents_chemin_conforme_au_type (dette #49, 10/08/2026), qui ne tenait que le lien type->prefixe et laissait donc une ligne designer le fichier d''une AUTRE ligne du meme type. Trigger et non CHECK pour deux raisons mesurees : documents ne porte aucune colonne vers sa ligne source (il faut LIRE, une CHECK exige de l''IMMUTABLE), et 14 des 179 lignes existantes violent le predicat — une CHECK validee echouerait, un NOT VALID mentirait. Mesure avant pose : 165 conformes, 14 non conformes, toutes nommees dans le §4 du fichier de migration.';


-- ---------------------------------------------------------------------
--  6. VERIFICATION EXECUTEE, PAS SUPPOSEE
--
--  Sept epreuves (huit assertions, la 7e ayant deux moities), dont TROIS
--  qui doivent PASSER : une garde qu'on ne teste que sur ses refus peut
--  parfaitement refuser TOUT — c'est le « risque symetrique » du §🔴 de
--  20260810100000, et il se mesure, il ne se suppose pas.
--
--    REFUS attendus       E1 ancrage divergent (la dette #51 elle-meme)
--                         E3 reference inexistante
--                         E4 apercu_url (la colonne voisine du 09/08)
--                         E5 lot_id NULL sur un type de classe A
--                         E7b repointage d'une ligne heritee
--    ACCEPTATIONS         E2 ecriture legitime (generation-document)
--      attendues          E6 plan_lot, hors perimetre (module geometre)
--                         E7a ligne heritee, colonne non structurante
--
--  🔴 AUCUNE ECRITURE NE SURVIT A CE BLOC. Chaque epreuve vit dans un
--  sous-bloc `begin … exception` — donc dans une SOUS-TRANSACTION — qui se
--  termine TOUJOURS par un `raise` (sentinelle en cas de succes, refus de
--  la garde en cas d'echec). Dans les deux cas la sous-transaction est
--  ANNULEE et l'INSERT/UPDATE d'epreuve disparait. Les variables plpgsql,
--  elles, survivent a l'annulation d'un sous-bloc (comportement
--  documente), ce qui permet de sortir le verdict sans laisser de trace —
--  meme technique que la sonde de role de 20260811100000.
-- ---------------------------------------------------------------------

do $$
declare
  v_ref        text;
  v_lot_vrai   uuid;
  v_lot_autre  uuid;
  v_url        text;
  v_id_test    uuid;
  v_id_orphan  constant uuid := '4c5669ba-040b-41fb-b924-94bf4942aa8c';
  v_refuse     boolean;
  v_sqlstate   text;
  v_msg        text;
begin
  -- Jeu d'essai pris DANS LES DONNEES, jamais code en dur : le fichier
  -- reste valable si la base change de references.
  select a.reference, a.lot_id into v_ref, v_lot_vrai
  from public.attestations_cession a
  where a.reference is not null
  order by a.reference
  limit 1;
  if v_ref is null then
    raise exception 'Verification IMPOSSIBLE : aucune attestations_cession avec reference (106 mesurees le 11/08/2026).';
  end if;

  select l.id into v_lot_autre from public.lots l where l.id <> v_lot_vrai limit 1;
  if v_lot_autre is null then
    raise exception 'Verification IMPOSSIBLE : aucun second lot pour construire la divergence.';
  end if;

  v_url := 'attestations_cession/' || v_ref || '.pdf';

  -- ═══ EPREUVE 1 — LA DETTE #51 ELLE-MEME : reference REELLE d'un tiers,
  --     ancrage sur MON lot. C'est le scenario exact de l'enonce. Doit
  --     etre REFUSE.
  v_refuse := false;
  begin
    insert into public.documents (type, url_fichier, lot_id)
    values ('attestation_cession'::public.type_document, v_url, v_lot_autre);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_sqlstate := sqlstate; v_msg := sqlerrm;
    end if;
  end;
  if not v_refuse then
    raise exception
      'EPREUVE 1 ECHOUEE — la dette #51 N''EST PAS FERMEE : une ligne declarant la reference % '
      '(dont le lot reel est %) avec lot_id=% a ete ACCEPTEE.', v_ref, v_lot_vrai, v_lot_autre;
  end if;
  if v_sqlstate <> '23514' then
    raise exception 'EPREUVE 1 : refus obtenu mais sous le mauvais code % (23514 attendu) — %', v_sqlstate, v_msg;
  end if;
  if position('ancrage divergent' in v_msg) = 0 then
    raise exception 'EPREUVE 1 : refus obtenu mais le motif ne nomme pas la cause — %', v_msg;
  end if;
  -- L'oracle reste ferme : le motif ne doit PAS reveler le lot attendu.
  if position(v_lot_vrai::text in v_msg) > 0 then
    raise exception 'EPREUVE 1 : le motif REVELE le lot_id de la ligne source (oracle reference->lot) — %', v_msg;
  end if;

  -- ═══ EPREUVE 2 — LE RISQUE SYMETRIQUE : la MEME ecriture, avec le BON
  --     lot. Doit PASSER. Sans cette epreuve, une garde qui refuse tout
  --     passerait l'epreuve 1 haut la main.
  v_refuse := false;
  begin
    insert into public.documents (type, url_fichier, lot_id)
    values ('attestation_cession'::public.type_document, v_url, v_lot_vrai);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_sqlstate := sqlstate; v_msg := sqlerrm;
    end if;
  end;
  if v_refuse then
    raise exception
      'EPREUVE 2 ECHOUEE — la garde REFUSE une ecriture LEGITIME (reference % sur son propre lot %) : '
      'generation-document ne pourrait plus deposer aucune attestation. [%] %', v_ref, v_lot_vrai, v_sqlstate, v_msg;
  end if;

  -- ═══ EPREUVE 3 — reference INEXISTANTE sous le bon prefixe. Doit etre
  --     REFUSE (c'est la porte qu'ouvre tout role sachant inserer).
  v_refuse := false;
  begin
    insert into public.documents (type, url_fichier, lot_id)
    values ('attestation_cession'::public.type_document,
            'attestations_cession/ZZZ-INEXISTANT-2026-99999.pdf', v_lot_vrai);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_msg := sqlerrm;
    end if;
  end;
  if not v_refuse then
    raise exception 'EPREUVE 3 ECHOUEE — une reference inexistante a ete ACCEPTEE.';
  end if;
  if position('aucune ligne source' in v_msg) = 0 then
    raise exception 'EPREUVE 3 : refus obtenu mais le motif ne nomme pas la cause — %', v_msg;
  end if;

  -- ═══ EPREUVE 4 — LA COLONNE VOISINE (lecon du 09/08) : url_fichier
  --     PARFAITEMENT legitime, mais apercu_url pointant sur l'acte. Doit
  --     etre REFUSE — c'est exactement par la que #49 avait ete rouverte.
  v_refuse := false;
  begin
    insert into public.documents (type, url_fichier, apercu_url, lot_id)
    values ('attestation_cession'::public.type_document, v_url, v_url, v_lot_vrai);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_msg := sqlerrm;
    end if;
  end;
  if not v_refuse then
    raise exception
      'EPREUVE 4 ECHOUEE — apercu_url ACCEPTEE sur un type du perimetre : la colonne voisine rouvre #51, '
      'exactement comme elle avait rouvert #49 le 09/08.';
  end if;
  if position('apercu_url' in v_msg) = 0 then
    raise exception 'EPREUVE 4 : refus obtenu mais le motif ne nomme pas la cause — %', v_msg;
  end if;

  -- ═══ EPREUVE 5 — L'ECHAPPATOIRE NULL de la classe A. Doit etre REFUSE.
  v_refuse := false;
  begin
    insert into public.documents (type, url_fichier, lot_id)
    values ('attestation_cession'::public.type_document, v_url, null);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_msg := sqlerrm;
    end if;
  end;
  if not v_refuse then
    raise exception
      'EPREUVE 5 ECHOUEE — une attestation_cession SANS lot_id a ete acceptee : la ligne echappe a toute '
      'confrontation avec sa source.';
  end if;

  -- ═══ EPREUVE 6 — `plan_lot` est HORS PERIMETRE et doit rester
  --     ecrivable. Le mandat l'exige explicitement ; c'est aussi le module
  --     geometre qui tomberait.
  v_id_test := gen_random_uuid();
  v_refuse := false;
  begin
    insert into public.documents (id, type, url_fichier, lot_id)
    values (v_id_test, 'plan_lot'::public.type_document,
            'plans-cad/' || v_id_test::text || '/original.dwg', v_lot_vrai);
    raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
  exception when others then
    if sqlerrm <> '__EPREUVE_A_PASSE__' then
      v_refuse := true; v_sqlstate := sqlstate; v_msg := sqlerrm;
    end if;
  end;
  if v_refuse then
    raise exception
      'EPREUVE 6 ECHOUEE — un plan_lot legitime est REFUSE alors qu''il est hors perimetre : le module '
      'geometre tombe. [%] %', v_sqlstate, v_msg;
  end if;

  -- ═══ EPREUVE 7 — LES 14 LIGNES HERITEES : modifiables sur une colonne
  --     non structurante, INMODIFIABLES sur url_fichier. Les deux moities
  --     comptent : la premiere prouve que le garde de declenchement ne
  --     brique rien, la seconde qu'il ne laisse pas repointer une orpheline.
  if exists (select 1 from public.documents where id = v_id_orphan) then
    v_refuse := false;
    begin
      update public.documents set titre = coalesce(titre, '') || '' where id = v_id_orphan;
      raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
    exception when others then
      if sqlerrm <> '__EPREUVE_A_PASSE__' then
        v_refuse := true; v_sqlstate := sqlstate; v_msg := sqlerrm;
      end if;
    end;
    if v_refuse then
      raise exception
        'EPREUVE 7a ECHOUEE — une ligne heritee n''est plus modifiable sur `titre` : le garde de '
        'declenchement du §2 ne fait pas son office, 14 lignes du registre sont briquees. [%] %',
        v_sqlstate, v_msg;
    end if;

    v_refuse := false;
    begin
      update public.documents set url_fichier = v_url where id = v_id_orphan;
      raise exception using errcode = 'P0001', message = '__EPREUVE_A_PASSE__';
    exception when others then
      if sqlerrm <> '__EPREUVE_A_PASSE__' then
        v_refuse := true; v_msg := sqlerrm;
      end if;
    end;
    if not v_refuse then
      raise exception
        'EPREUVE 7b ECHOUEE — une ligne heritee a pu etre REPOINTEE vers l''acte % : le garde de '
        'declenchement laisse passer un changement d''url_fichier.', v_ref;
    end if;
  end if;

  -- Aucune ecriture ne doit avoir survecu aux sept epreuves.
  if exists (select 1 from public.documents where id = v_id_test) then
    raise exception 'FUITE : la ligne d''epreuve % a SURVECU — les sous-transactions n''ont pas ete annulees.', v_id_test;
  end if;

  -- ⚠️ Ce `notice` est MUET a travers scripts/supabase-sql.ps1 (cf. §4). Il
  -- n'est pas le verdict : le verdict, c'est qu'aucune des 8 assertions
  -- ci-dessus n'a leve. Il n'est la que pour une application via psql.
  raise notice
    'Dette #51 FERMEE et VERIFIEE : 8 controles (5 refus attendus — E1 divergence, E3 reference '
    'inexistante, E4 apercu_url, E5 lot_id NULL, E7b repointage ; 3 acceptations attendues — E2 '
    'ecriture legitime, E6 plan_lot hors perimetre, E7a ligne heritee editable). Jeu d''essai '
    'reference=% lot=% lot_tiers=%. Trigger trg_documents_ancrage pose sur public.documents.',
    v_ref, v_lot_vrai, v_lot_autre;
end $$;
