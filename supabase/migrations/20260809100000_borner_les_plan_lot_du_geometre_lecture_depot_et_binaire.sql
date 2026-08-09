-- =====================================================================
--  DETTE #33 — « tout géomètre lit tous les `plan_lot` du pays »
--
--  Énoncé d'origine (§4.3 du document directeur), VERBATIM :
--    « `documents_geometre_plans_read` : tout géomètre lit tous les
--      `plan_lot` du pays. […] État de la policy en production, relu le
--      30/07 : SELECT, rôle `authenticated`,
--      `qual = (mon_groupe() = 'geometre' AND type = 'plan_lot')` —
--      aucun scope. […] La policy jumelle
--      `documents_geometre_plans_insert` (INSERT) porte le même prédicat
--      sans scope en `with check` : un géomètre peut aussi déposer un
--      `plan_lot` sur n'importe quel dossier. […] Correctif connu :
--      borner par `mon_geometre_id()` sur les deux policies, sur le
--      modèle de `missions_geometre`/`pv_bornage`. »
--
--  🔴 LE CORRECTIF « CONNU » DE L'ÉNONCÉ N'EST PAS TRANSPOSABLE. Il est
--  écrit ici parce que le reprendre tel quel aurait VIDÉ L'ÉCRAN :
--
--   (a) `documents` ne porte NI `geometre_id`, NI `mission_id`, NI
--       `dossier_id`. Ses seules colonnes de rattachement sont `lot_id`,
--       `lotissement_id` et `televerse_par` (15 colonnes relues en
--       production le 09/08). `mon_geometre_id()` ne s'y branche par
--       aucune égalité directe.
--   (b) Les trois tables du modèle invoqué sont VIDES en production :
--       `missions_geometre` = 0 ligne, `pv_bornage` = 0, `dossiers_adu`
--       = 0. Un scope qui passe par elles couvre 0 des 2 `plan_lot`
--       existants : le géomètre de démonstration perdrait ses deux
--       propres plans, et `/dashboard/documents` afficherait une liste
--       vide — un refus RLS ne lève pas, il rend 0 ligne (dette #45).
--
--  ── COUVERTURE MESURÉE DES CHEMINS DE SCOPE, sur les 2 `plan_lot` ────
--    A  `televerse_par = auth.uid()`                          2/2
--    B  `missions_geometre` (lot_id + mon_geometre_id())       0/2
--    C  via `dossiers_adu`                                     0/2
--    D  via `pv_bornage.mission_id`                            0/2
--    A ∪ B                                                     2/2
--
--  ── ARBITRAGE DU PROPRIÉTAIRE DU PROJET (09/08) : OPTION C = A ∪ B ───
--  « Oui, un plan téléversé par un admin doit rester lisible au géomètre
--  en mission sur le lot » — d'où la branche B, CONSERVÉE bien qu'elle
--  ne couvre 0 ligne aujourd'hui. Elle n'est pas décorative : elle est
--  le seul chemin par lequel un plan qu'il n'a pas déposé lui
--  reviendra, le jour où une mission existera.
--
--  ── MESURE AVANT, PAR EMPRUNT DE RÔLE (09/08) ────────────────────────
--  Témoin relevé DANS la transaction :
--    a8abac12-… / groupe=geometre / geometre_id=7d4ce22a-… /
--    role=authenticated
--    documents lus         : 2
--    dont plan_lot         : 2
--    md5 des ids lus       : 4d633e8fa209650081ea3968711df5b1
--    md5 du stock NATIONAL : 4d633e8fa209650081ea3968711df5b1   (admin)
--  Les deux md5 sont ÉGAUX : il lit 100 % du stock national de
--  `plan_lot`. Et son profil ne porte ni `attributaire_id`, ni
--  `operateur_id`, ni `autorite_coutumiere_id`, ni `famille_id`, et
--  `est_admin()` est faux — donc AUCUNE des cinq autres policies de
--  `documents` ne le sert : `documents_geometre_plans_read` est bien le
--  seul chemin, et le resserrer se verra.
--
--  ── CE QUE CE FICHIER TOUCHE — TROIS OBJETS, PAS DEUX ────────────────
--   1. `documents_geometre_plans_read`   (SELECT sur public.documents)
--   2. `documents_geometre_plans_insert` (INSERT sur public.documents)
--   3. `documents_plans_cad_upload`      (INSERT sur storage.objects)
--
--  Le 3ᵉ est ABSENT de l'énoncé de la dette. C'est le jumeau storage de
--  la fuite en écriture : `bucket_id='documents' AND foldername[1] =
--  'plans-cad' AND (mon_groupe()='geometre' OR est_admin())`, sans
--  aucun scope. Refermer la table sans lui aurait laissé un géomètre
--  déverser des binaires dans le bucket privé — et, mesuré, 4 des 7
--  objets sous `plans-cad/` sont DÉJÀ orphelins (aucune ligne
--  `documents` ne les réclame), preuve que ce chemin s'emprunte seul.
--
--  🔴 CE FICHIER NE PEUT PAS ÊTRE APPLIQUÉ SEUL. Le §6 exige que la
--  ligne `documents` EXISTE avant que son binaire n'arrive ; le front
--  fait aujourd'hui l'inverse. L'ordre de livraison est donc IMPOSÉ :
--  déployer d'abord `UploadPlanModal.tsx` (ligne d'abord, binaire
--  ensuite — le front modifié fonctionne aussi sous les policies
--  ACTUELLES), APPLIQUER CETTE MIGRATION ENSUITE. L'ordre inverse rend
--  le téléversement impossible entre les deux gestes.
--
--  ── ⚠️ « LE FRONT », CE N'EST PAS QUE VERCEL : IL Y A AUSSI L'APK ────
--  `android/app/src/main/assets/public/` embarque un bundle figé, et il
--  porte ENCORE l'ancien ordre — vérifié le 09/08 dans le chunk
--  `_next/static/chunks/05an51idl0okq.js` :
--      upload(`plans-cad/${t}/original.dxf`, E) … puis .insert({…})
--  Un `git push` met Vercel à jour, il ne met PAS à jour un APK déjà
--  installé sur un téléphone. Deux lectures possibles, il faut en
--  choisir une AVANT d'appliquer :
--   (a) rigoureuse — publier le web ET un nouveau build Android
--       (`pnpm build && npx cap sync && …`) avant la migration ;
--   (b) pragmatique, et c'est celle qui est retenue aujourd'hui —
--       l'enjeu est NUL : `UploadPlanModal` n'est monté que derrière
--       `peutTeleverserPlan` (admin ou `groupe='geometre'`), il n'existe
--       qu'UN compte `geometre` en production et c'est un compte de
--       DÉMONSTRATION, dont personne n'a l'APK. Le seul dégât possible
--       est donc « un téléversement refusé depuis un vieil APK », sur un
--       compte de test. Le rebuild Android peut suivre au prochain
--       passage.
--  Ce qui n'était pas acceptable, c'est de le laisser implicite : c'est
--  écrit ici pour qu'un futur lecteur ne redécouvre pas le décalage en
--  production.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. La branche B, extraite dans son propre prédicat
--
--  ── Pourquoi une fonction SECURITY DEFINER, et pas un `exists` écrit
--     directement dans la policy ─────────────────────────────────────
--  `missions_geometre` porte sa propre RLS
--  (`missions_geometre_owner_all`, `missions_geometre_admin_all`). Un
--  `exists` inscrit dans la policy serait évalué SOUS la RLS de
--  l'appelant : le fait « ce géomètre a une mission sur ce lot »
--  deviendrait « vrai si la RLS de `missions_geometre` veut bien le lui
--  montrer ». Ici les deux coïncident par chance — la policy owner rend
--  précisément ses missions — mais c'est une coïncidence, pas une
--  garantie, et elle tombera au premier resserrement de cette table. Le
--  fait doit être VRAI ou FAUX. Même raisonnement qu'au §3 de
--  20260729170000 et qu'au §1 de 20260808100000.
--
--  ── Les `is not null`, et le piège du 28/07 ──────────────────────────
--  `NULL = NULL` rend NULL, donc faux. Un seul `is not distinct from` ou
--  un `coalesce` mal placé le rendrait VRAI et ouvrirait la lecture à
--  TOUS les profils sans géomètre rattaché — la forme exacte de la
--  faille de garde de juridiction du 28/07. Les gardes sont donc
--  ÉCRITES, jamais déduites : `p_lot_id`, `auth.uid()` et
--  `mon_geometre_id()` sont testés `is not null` avant toute égalité.
--
--  ── Ce qui n'est PAS filtré, et pourquoi c'est signalé ───────────────
--  ⚠️ `missions_geometre.statut` n'est pas testé : une mission
--  `annulee` ouvrira donc la lecture au même titre qu'une mission
--  `en_cours`. Le prédicat est repris tel qu'arbitré, sans y ajouter un
--  filtre que personne n'a tranché ; la table est vide, la question ne
--  coûte rien aujourd'hui. Elle est posée au propriétaire du projet et
--  devra l'être avant la première mission réelle : le jour où une
--  mission est annulée, faut-il retirer au géomètre les plans du lot ?
-- ---------------------------------------------------------------------

create or replace function public.est_geometre_en_mission_sur_le_lot(p_lot_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_lot_id is not null
     and auth.uid() is not null
     and public.mon_geometre_id() is not null
     and exists (
       select 1
       from missions_geometre m
       where m.lot_id = p_lot_id
         and m.geometre_id = public.mon_geometre_id()
     );
$function$;

comment on function public.est_geometre_en_mission_sur_le_lot(uuid) is
  'Vrai si le compte appelant est rattaché à un géomètre-expert (profiles.geometre_id) qui porte au moins une mission sur CE lot. Branche B du correctif de la dette #33 (09/08/2026) : elle couvre 0 des 2 plan_lot existants — missions_geometre est vide —, et n''existe que pour rendre au géomètre en mission un plan qu''il n''a pas déposé lui-même. Ne filtre PAS sur statut : une mission annulée ouvre la lecture, question non tranchée.';


-- ---------------------------------------------------------------------
--  2. Le binaire ne peut atterrir QU'À l'emplacement que sa ligne déclare
--
--  Prédicat du §5 (storage). Il est défini ici, avant les ACL, pour que
--  les deux fonctions neuves soient refermées d'un seul bloc.
--
--  ── Ce qu'il exprime ─────────────────────────────────────────────────
--  « Il existe une ligne `documents` de type `plan_lot`, dont
--  `url_fichier` est EXACTEMENT ce chemin, et dont `televerse_par` est
--  l'appelant. »
--
--  Comparer le chemin ENTIER à `url_fichier` — plutôt que d'extraire
--  l'identifiant du dossier par `storage.foldername(name)` et de le
--  caster en `uuid` — a trois vertus :
--   * aucun cast : un segment non-uuid ferait lever `22P02` DANS une
--     policy, et l'ordre d'évaluation des opérandes d'un `AND` n'est pas
--     garanti par PostgreSQL — une garde de forme placée « avant » le
--     cast ne le protège pas ;
--   * la convention de nommage reste celle qui est DÉJÀ en base
--     (`plans-cad/<id du document>/original.<ext>`, vérifié sur les 7
--     objets) : rien à changer dans `convertir-plan-cad`, qui écrit son
--     aperçu à côté sous `plans-cad/<id>/apercu.svg` — en `service_role`,
--     donc hors RLS de toute façon ;
--   * un objet = une ligne : on ne peut pas déposer un second fichier,
--     ni un fichier de nom libre, dans le dossier d'une ligne existante.
--
--  ── SECURITY DEFINER, ici aussi ──────────────────────────────────────
--  La fonction lit `documents`, dont la RLS vient précisément d'être
--  resserrée au §3. Sans SECURITY DEFINER, le droit de DÉPOSER un
--  binaire dépendrait du droit de LIRE la ligne : deux règles qui n'ont
--  aucune raison de rester alignées, et dont la divergence se lirait
--  comme une panne de téléversement inexplicable.
-- ---------------------------------------------------------------------

create or replace function public.plan_cad_reclame_par_sa_ligne(p_nom text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_nom is not null
     and auth.uid() is not null
     and exists (
       select 1
       from documents d
       where d.url_fichier = p_nom
         and d.type = 'plan_lot'::type_document
         and d.televerse_par is not null
         and d.televerse_par = auth.uid()
     );
$function$;

comment on function public.plan_cad_reclame_par_sa_ligne(text) is
  'Vrai si le chemin storage passé est EXACTEMENT l''url_fichier d''une ligne documents de type plan_lot déposée par l''appelant. Porte le resserrement de documents_plans_cad_upload (dette #33, 09/08/2026) : le binaire ne peut atterrir qu''à l''emplacement qu''une ligne réclame déjà, ce qui impose au front d''écrire la ligne AVANT d''envoyer le fichier.';


-- ---------------------------------------------------------------------
--  3. ACL — le défaut d'exécution de ce projet est câblé vers PUBLIC
--
--  🔴 `revoke … from public` NE SUFFIT PAS — mais PAS pour la raison
--  qu'on lit ailleurs dans ce dépôt. Le fait a changé, et le commentaire
--  qui l'énonçait était PÉRIMÉ ; il est corrigé ici, relu en catalogue le
--  09/08 (`pg_default_acl`, schéma `public`) :
--
--    propriétaire `postgres`,        objets `f` (fonctions) :
--        {postgres=X, authenticated=X, service_role=X}   ← plus d'`anon`
--    propriétaire `supabase_admin`,  objets `f` :
--        {postgres=X, anon=X, authenticated=X, service_role=X}
--
--  `anon` a été RETIRÉ du défaut de `postgres` le 30/07 par
--  20260730010000 ; celui de `supabase_admin` le porte encore, mais
--  `alter default privileges for role supabase_admin` avait été refusé en
--  42501 (c'est le bloc « tentative honnête » de ce même fichier) — et il
--  ne s'applique de toute façon PAS ici : les deux fonctions ci-dessus
--  sont créées par `postgres`, c'est donc le défaut de `postgres` qui les
--  dote. Elles ne naissent PAS avec un grant nommé à `anon`.
--
--  Ce qui subsiste réellement, c'est l'autre mécanisme : le défaut CÂBLÉ
--  de PostgreSQL, qui accorde EXECUTE à PUBLIC sur toute fonction neuve —
--  il n'apparaît dans aucun `pg_default_acl` et ne se voit qu'en lisant
--  `proacl is null`. C'est lui que l'event trigger retire.
--
--  Le SQL reste donc écrit `from public, anon` : il couvre les DEUX
--  mécanismes, il est idempotent, il ne dépend pas de l'ACL en place, et
--  il resterait juste si le défaut de `supabase_admin` redevenait un jour
--  la source (restauration, changement de propriétaire). Seule la
--  justification changeait — et dans ce dépôt, un commentaire faux est un
--  piège, pas un détail.
--
--  L'event trigger `evt_fonctions_neuves_fermees_a_anon` se déclenchera
--  sur les deux `create or replace` ci-dessus : c'est voulu, on ne le
--  désarme pas. Il ne retire que l'aclitem PUBLIC, jamais un grant
--  nommé, donc le `grant … to authenticated` qui suit survit.
--
--  Le contrôle horaire `securite-exposition-anon` doit continuer à rendre
--  0 écart : aucune des deux fonctions n'est accordée à `anon`, elles
--  n'entrent donc dans aucune des listes de référence de 20260730040000
--  / 050000, qui n'énumèrent que ce qui est atteignable par `anon`.
--  Aucune ligne de base à mettre à jour.
--
--  `service_role` n'est pas nommé : les edge functions
--  (`telecharger-document`, `convertir-plan-cad`) contournent la RLS,
--  elles n'appellent aucune de ces deux fonctions.
-- ---------------------------------------------------------------------

revoke all on function public.est_geometre_en_mission_sur_le_lot(uuid) from public, anon;
revoke all on function public.plan_cad_reclame_par_sa_ligne(text)      from public, anon;

grant execute on function public.est_geometre_en_mission_sur_le_lot(uuid) to authenticated;
grant execute on function public.plan_cad_reclame_par_sa_ligne(text)      to authenticated;


-- ---------------------------------------------------------------------
--  4. LECTURE — `documents_geometre_plans_read` reçoit son scope
--
--  `alter policy` et non `drop`+`create` : pas de fenêtre, même courte,
--  pendant laquelle la table serait sans cette policy, et le rôle
--  attaché (`authenticated`) reste celui d'origine.
--
--  ── Pourquoi `auth.uid() is not null` n'est pas répété au premier
--     niveau ────────────────────────────────────────────────────────
--  Sans session, `mon_groupe()` rend NULL, donc `= 'geometre'` rend NULL
--  — la policy ne passe pas. La garde de session est déjà portée, et
--  chacune des deux branches porte la sienne (`televerse_par is not
--  null` ici, `auth.uid() is not null` dans la fonction du §1).
--
--  ── Ce que les CINQ AUTRES policies de `documents` ne rouvrent pas ───
--  Les policies permissives se combinent en OU : resserrer celle-ci n'en
--  retire aucune autre. Vérifié une à une, contre le profil réel du seul
--  compte `geometre` (mesure du bandeau : aucun rattachement) :
--   · `documents_admin_all`        — `est_admin()` = false.
--   · `documents_lot_parties_read` — `peut_lire_documents_du_lot()` ne
--     sert que la chefferie de la juridiction et l'opérateur du parc ;
--     `autorite_coutumiere_id` et `operateur_id` sont NULL.
--   · `documents_lotissement_read` — exige `lotissement_id is not null` ;
--     les 2 `plan_lot` existants l'ont à NULL, donc elle ne les sert pas.
--     ⚠️ UNE PREMIÈRE RÉDACTION DE CE COMMENTAIRE DISAIT « cette policy
--     ne peut JAMAIS servir un plan_lot », en invoquant la contrainte
--     `documents_rattachement_exclusif`. C'ÉTAIT FAUX, et le vérificateur
--     l'a relevé. Relue en base le 09/08, elle vaut :
--         CHECK ((lot_id IS NULL) OR (lotissement_id IS NULL))
--     — elle interdit seulement les DEUX à la fois. Un `plan_lot` portant
--     un `lotissement_id` (et `lot_id` à NULL) était donc parfaitement
--     légal, et `documents_lotissement_read` l'aurait servi à TOUS les
--     porteurs de `peut_lire_documents_lotissement` : la pollution
--     possible visait un LOTISSEMENT ENTIER, pas un lot.
--     C'est fermé au §5 (`lotissement_id is null` dans le `with check`),
--     et c'est la clause qui rend la phrase vraie — pas la contrainte.
--   · `documents_read` — deux branches : `attributions` avec
--     `mon_attributaire_id()` (NULL ici), et
--     `est_signataire_acte_du_lot(lot_id, url_fichier)`, qui exige que
--     la RÉFÉRENCE d'une attestation qu'il a signée soit contenue dans
--     `url_fichier` ; un chemin `plans-cad/<uuid>/original.dwg` n'en
--     contient aucune.
--   · `documents_geometre_plans_insert` — INSERT, ne rend aucune ligne.
--  Le contrôle qui tranche reste la mesure par emprunt de rôle (cf. la
--  note de vérification), pas cette déduction.
-- ---------------------------------------------------------------------

alter policy documents_geometre_plans_read on public.documents
using (
  public.mon_groupe() = 'geometre'::public.groupe_utilisateur
  and type = 'plan_lot'::public.type_document
  and (
    -- A — le plan qu'il a lui-même déposé. Couvre 2/2 aujourd'hui.
    (televerse_par is not null and televerse_par = auth.uid())
    or
    -- B — le plan d'un lot sur lequel il porte une mission, quel qu'en
    --     soit le déposant (arbitrage du 09/08). Couvre 0/2 aujourd'hui.
    (lot_id is not null and public.est_geometre_en_mission_sur_le_lot(lot_id))
  )
);


-- ---------------------------------------------------------------------
--  5. DÉPÔT — `documents_geometre_plans_insert`
--
--  🔴 LE POINT CAPITAL : `televerse_par` EST POSÉ PAR LE CLIENT.
--  `UploadPlanModal.tsx` l'écrit lui-même dans l'`insert`, et RIEN en
--  base ne le contraignait : ni valeur par défaut, ni trigger, ni
--  contrainte. Reporter le prédicat de lecture sans cette égalité aurait
--  remplacé une fuite EN LECTURE par une USURPATION EN ÉCRITURE — un
--  géomètre déposant un plan au nom d'un confrère, qui l'aurait ensuite
--  vu apparaître dans SON coffre-fort par la branche A. L'égalité est
--  donc imposée au PREMIER NIVEAU du `and`, jamais dans une branche du
--  `or`.
--
--  ── POURQUOI LA BRANCHE B N'EST PAS RECOPIÉE ICI — lire avant de
--     conclure à un écart ────────────────────────────────────────────
--  La consigne demandait « le même prédicat en `with check`, PLUS la
--  contrainte `televerse_par = auth.uid()` », soit :
--
--      A' ∧ B' ∧ ( C ∨ D ) ∧ C        où C = (televerse_par = auth.uid())
--
--  Or `C ∧ (C ∨ D) ≡ C` — et l'équivalence tient aussi en logique
--  ternaire : si C est VRAI, `C ∨ D` est VRAI ; si C est FAUX ou NULL,
--  l'expression entière n'est pas VRAIE dans les deux écritures, et
--  seule la valeur VRAIE laisse passer une policy. Le prédicat écrit
--  ci-dessous est donc RIGOUREUSEMENT ÉQUIVALENT à celui qui était
--  demandé, à la lettre près.
--
--  Il est écrit sous sa forme réduite parce que la forme longue MENT :
--  un lecteur y verrait un dépôt borné aux missions du géomètre, alors
--  que la branche `missions_geometre` n'y retire rien. Écrire une garde
--  qui ne garde rien dans un prédicat de sécurité est précisément la
--  faute que ce dépôt paie à répétition.
--
--  ── 🔴 LA CLAUSE `url_fichier` : ELLE FERME UNE ESCALADE DE PRIVILÈGE ─
--  Ajoutée le 09/08 après le passage du vérificateur. Sans elle, le
--  prédicat ci-dessous n'imposait RIEN sur `url_fichier`, et la chaîne
--  suivante était ouverte — vérifiée dans le code, pas supposée :
--   ① le géomètre insère une ligne `plan_lot` À SON NOM (les trois
--      premières clauses sont satisfaites) dont `url_fichier` vaut
--      `attestations_cession/ATT-CESS-2026-00846.pdf` ;
--   ② la branche A du §4 la lui rend — c'est SA ligne ;
--   ③ `supabase/functions/telecharger-document/index.ts` relit la ligne
--      avec SON jeton (donc le contrôle passe), puis, ligne 79, prend
--      `chemin = row.url_fichier` TEL QUEL, sans validation de préfixe,
--      et signe lignes 84-86 une URL de 120 s **en `service_role`**.
--  → lecture de n'importe quel objet du bucket privé `documents`. Et les
--  chemins sont ÉNUMÉRABLES : les références `ATT-CESS-2026-00846` …
--  `00851` sont séquentielles, 107 objets mesurés.
--  La clause `url_fichier like 'plans-cad/' || id || '/%'` referme ce
--  chemin-là : une ligne ne peut plus désigner que son propre dossier.
--  Les 2 lignes existantes respectent déjà cette forme (relu en base le
--  09/08, `respecte_convention = true` sur les deux) ; un `with check`
--  ne s'applique de toute façon qu'aux écritures.
--
--  ⚠️ ET IL A FALLU DEUX PASSES POUR LA FERMER VRAIMENT. La première
--  version de cette clause ne couvrait que `url_fichier`. Or l'edge
--  function signe `apercu_url` dès que l'appelant demande
--  `variant = 'apercu'` — un paramètre qu'IL choisit. La fuite restait
--  donc entière par la colonne voisine, sur une ligne par ailleurs
--  irréprochable. Elle a été trouvée par le vérificateur, sur un
--  correctif qui se déclarait complet. Trois clauses sont donc
--  nécessaires, pas une : le préfixe, l'interdiction des `..`, et
--  `apercu_url is null`.
--
--  🔴 MAIS LA FAILLE DE `telecharger-document` N'EST PAS FERMÉE POUR
--  AUTANT — DETTE DISTINCTE, À OUVRIR. Elle est seulement devenue
--  inatteignable PAR CE CHEMIN-CI. Elle reste entière pour tout rôle
--  capable de créer une ligne `documents` d'un AUTRE type, ou de poser
--  un `url_fichier` libre. Le correctif de fond est dans l'edge function
--  (valider que le chemin appartient au préfixe attendu du type), pas
--  dans une policy — et il exige un redéploiement, hors périmètre de ce
--  fichier.
--
--  ── LA CLAUSE `lotissement_id is null` ────────────────────────────────
--  Voir le §4 : `documents_rattachement_exclusif` n'interdit que les DEUX
--  rattachements à la fois. Un `plan_lot` accroché à un lotissement était
--  légal et aurait été servi, via `documents_lotissement_read`, à tous
--  les lecteurs de ce lotissement. Coût de la fermeture : nul — le front
--  n'a jamais renseigné que `lot_id`.
--
--  ── 🔴 CE QUE CE PRÉDICAT NE FERME DONC PAS — À ARBITRER ─────────────
--  Un géomètre peut TOUJOURS attacher un `plan_lot` à N'IMPORTE LEQUEL
--  des 898 lots du pays. Ce qui change : le dépôt est désormais SIGNÉ —
--  il ne peut être fait qu'en son propre nom —, son chemin ne peut plus
--  mentir, et il n'est visible que de lui, de l'admin, et de la chefferie
--  / l'opérateur de ce lot.
--  Le résidu réel est donc la POLLUTION : un faux plan déposé sur le
--  dossier d'autrui, que les parties de ce lot verront.
--  Le fermer exige un lien positif géomètre → lot, c'est-à-dire la seule
--  branche B — qui, `missions_geometre` étant vide, refuserait
--  aujourd'hui 100 % des dépôts, y compris ceux du compte de
--  démonstration. Le jour où les missions existent, la fermeture tient
--  en une ligne, à substituer à la dernière du prédicat ci-dessous :
--      and lot_id is not null
--      and public.est_geometre_en_mission_sur_le_lot(lot_id)
--  Arbitrage du propriétaire du projet, pas correction technique.
-- ---------------------------------------------------------------------

alter policy documents_geometre_plans_insert on public.documents
with check (
  public.mon_groupe() = 'geometre'::public.groupe_utilisateur
  and type = 'plan_lot'::public.type_document
  -- La SIGNATURE : le dépôt ne peut être fait qu'en son propre nom.
  and televerse_par is not null
  and televerse_par = auth.uid()
  -- Le CHEMIN : il ne peut désigner que le dossier de CETTE ligne.
  and url_fichier is not null
  and url_fichier like ('plans-cad/' || id::text || '/%')
  -- …et il ne peut pas REMONTER hors de ce dossier. `like 'plans-cad/<id>/%'`
  -- est satisfait par `plans-cad/<id>/../../attestations_cession/X.pdf`, et
  -- le parseur d'URL normalise les `..` AVANT l'appel à storage : la garde de
  -- préfixe seule ne tient pas.
  and url_fichier not like '%..%'
  -- 🔴 LA COLONNE VOISINE, ET C'EST LA MÊME ESCALADE.
  -- `telecharger-document` (index.ts:79) signe en service_role :
  --     chemin = (variant = 'apercu') ? row.apercu_url : row.url_fichier
  -- et le `variant` est CHOISI PAR LE CLIENT. Contraindre `url_fichier` sans
  -- contraindre `apercu_url` ne fermait donc rien : il suffisait de déposer
  -- un plan parfaitement régulier dont l'`apercu_url` désigne une
  -- attestation. Défaut trouvé par le vérificateur APRÈS une première
  -- correction qui se croyait complète.
  -- `is null` et non un `like` : le front ne renseigne JAMAIS `apercu_url` à
  -- l'insert — c'est `convertir-plan-cad` qui l'écrit ensuite, en
  -- service_role, donc hors RLS. Interdire la colonne à l'écriture par le
  -- géomètre est à la fois plus simple et plus étanche qu'un motif.
  and apercu_url is null
  -- Le RATTACHEMENT : un plan de lot ne s'accroche pas à un lotissement.
  and lotissement_id is null
);


-- ---------------------------------------------------------------------
--  6. LE BINAIRE — `documents_plans_cad_upload` (storage.objects)
--
--  État relu le 09/08 :
--    with check = bucket_id='documents'
--             AND (storage.foldername(name))[1] = 'plans-cad'
--             AND (mon_groupe()='geometre' OR est_admin())
--  Aucun scope : tout compte `groupe='geometre'` pouvait écrire ce qu'il
--  voulait, sous le nom qu'il voulait, dans le bucket PRIVÉ `documents`.
--
--  ── CE QUE LE RESSERREMENT COUVRE ────────────────────────────────────
--  Le binaire doit être réclamé par une ligne `documents` que l'appelant
--  a le droit d'avoir écrite (§5) et dont `url_fichier` est exactement
--  ce chemin. Conséquences directes :
--   * plus de dépôt hors périmètre de ses propres lignes ;
--   * plus d'objet orphelin possible dans ce sens-là (4 des 7 objets
--     actuels le sont) ;
--   * plus de fichier de nom ou d'extension libre : le chemin est celui
--     que la ligne déclare, et le front le construit.
--
--  ── CE QUE LE RESSERREMENT NE COUVRE PAS — dit franchement ───────────
--   (a) Il n'ajoute AUCUNE borne de lot : il hérite exactement du
--       périmètre du §5. Un géomètre peut déposer le binaire d'un plan
--       qu'il a attaché à un lot quelconque. Même arbitrage en attente.
--   (b) Il ne borne ni la TAILLE ni le TYPE MIME : le bucket `documents`
--       est déclaré sans limite ni filtre (constat du 29/07, inchangé).
--       Un géomètre peut toujours saturer le bucket, à raison d'un objet
--       par ligne `documents` créée. Le borner est un réglage de bucket,
--       pas une policy.
--   (c) Il ne rattrape pas les 4 orphelins existants. Aucune suppression
--       n'est écrite ici : ce fichier ne détruit rien en production, et
--       le ménage est un geste séparé, à décider — les 4 objets
--       n'exposent rien (aucune policy SELECT ne couvre `plans-cad/`,
--       mesuré : le géomètre lit 0 objet storage).
--   (d) 🔴 Il DÉPEND du front. Tant que `UploadPlanModal.tsx` envoie le
--       fichier AVANT d'écrire la ligne, ce prédicat refuse tout dépôt.
--       Voir le bandeau de tête : le front d'abord, la migration
--       ensuite.
--
--  ── LES DEUX AUTRES FORMES ÉCARTÉES ──────────────────────────────────
--   * `owner = auth.uid()` : DÉCORATIF. C'est l'API Storage qui écrit
--     `owner` depuis le `sub` du jeton ; le client ne peut pas le
--     forger. La garde n'aurait interdit rien de ce qui était possible.
--   * préfixer le chemin par l'uid (`plans-cad/<uid>/<id>/…`) : cela
--     range le bucket par déposant mais n'empêche aucun orphelin, et
--     obligerait à redéployer `convertir-plan-cad`, qui construit le
--     chemin de l'aperçu par convention (`plans-cad/<id>/apercu.svg`).
--     Plus de surface remuée pour une garantie plus faible.
--
--  `est_admin()` reste une branche INCONDITIONNELLE : l'admin dépose
--  déjà tout par `documents_admin_all`, et le lui refuser ici casserait
--  le dépôt admin sans rien fermer — il peut de toute façon créer la
--  ligne qui réclamerait le binaire.
--
--  Fonctions SCHÉMA-QUALIFIÉES : la policy vit dans `storage`, et son
--  expression est résolue à la création contre le `search_path` de la
--  session qui l'applique. Ne pas s'en remettre à ce hasard.
--
--  ── ⚠️ SI CE §6 ÉCHOUE EN 42501, C'EST ATTENDU — voici quoi faire ────
--  `storage.objects` appartient à `supabase_storage_admin`, et le
--  catalogue est formel (relu le 09/08) : ce rôle n'a AUCUN membre, et
--  `postgres` — le rôle sous lequel `scripts/supabase-sql.ps1` exécute —
--  n'est ni membre ni superutilisateur. En théorie, `alter policy` sur
--  cette table lui est donc interdit.
--  En pratique il passe, et la preuve est en base : les trois policies
--  `documents_plans_lotissement_*` du §4 de 20260729170000 EXISTENT, et
--  le §5 du MÊME fichier est appliqué (`verifier_document` porte
--  `plan_morcellement_depose`, vérifié) — donc ce fichier est passé de
--  bout en bout par cette voie. Le passe-droit vient vraisemblablement
--  de `supabase_privileged_role`, que `postgres` détient.
--
--  🔴 CE QUI A CHANGÉ LE 09/08 APRÈS LE VÉRIFICATEUR — ET C'ÉTAIT LE
--  DÉFAUT LE PLUS DANGEREUX DU FICHIER. La rédaction précédente disait
--  « les §1 à §5 restent valides sans lui ». C'EST FAUX tel qu'écrit :
--  l'API de management envoie le corps du fichier **en une seule
--  requête**, et PostgreSQL enveloppe alors les instructions multiples
--  dans une TRANSACTION IMPLICITE. Un 42501 levé ici n'aurait pas
--  « seulement raté le §6 » : il aurait ANNULÉ LES §1 À §5 AVEC LUI, et
--  la migration se serait soldée par un échec propre… en laissant la
--  fuite entière. On aurait cru avoir livré.
--  Le §6 est donc désormais enveloppé dans un `do … exception when
--  insufficient_privilege`, sur le modèle EXACT de 20260730010000
--  (lignes 194-212), qui traite le même problème pour la même raison :
--  tenter, journaliser en WARNING, ne pas faire tomber le reste.
--
--  Et le recours indiqué était inefficace : l'éditeur SQL du tableau de
--  bord Supabase exécute sous LE MÊME rôle `postgres`. S'il y a 42501
--  par l'API, il y en aura un par l'éditeur. Le seul vrai recours est
--  l'UI **Storage → Policies**, qui passe par le service storage.
--
--  ⚠️ CONSÉQUENCE À NE PAS MANQUER : le succès de la migration ne prouve
--  plus l'application du §6. Il FAUT relire la policy après coup — le
--  script `scripts/e2e-dette-33-plans-geometre.sql` le fait (§A).
-- ---------------------------------------------------------------------

do $$
begin
  execute $pol$
    alter policy documents_plans_cad_upload on storage.objects
    with check (
      bucket_id = 'documents'
      and (storage.foldername(name))[1] = 'plans-cad'
      and (
        public.est_admin()
        or (
          public.mon_groupe() = 'geometre'::public.groupe_utilisateur
          and public.plan_cad_reclame_par_sa_ligne(name)
        )
      )
    )
  $pol$;
  raise notice 'documents_plans_cad_upload : resserree.';
exception when insufficient_privilege then
  raise warning
    'documents_plans_cad_upload NON resserree (42501 sous le role %) — '
    'les §1 a §5 SONT appliques, le bucket reste ouvert. '
    'Recours : UI Storage > Policies. NE PAS considerer la dette #33 close.',
    current_user;
end $$;


-- ---------------------------------------------------------------------
--  7. CE QUE CE FICHIER NE FAIT PAS, VOLONTAIREMENT
--
--   · Aucune policy DELETE n'est créée, ni sur `documents`, ni sur
--     `storage.objects`. Le géomètre ne peut donc pas nettoyer une ligne
--     dont l'envoi du binaire aurait échoué : elle restera visible, sans
--     fichier, jusqu'à ce qu'un admin la retire. C'est ASSUMÉ — lui
--     donner le DELETE lui donnerait aussi le pouvoir d'effacer un plan
--     sur lequel une chefferie s'appuie, dans un registre foncier. Un
--     enregistrement incomplet et VISIBLE vaut mieux qu'un binaire
--     orphelin invisible, qui est le comportement d'aujourd'hui.
--   · Aucune lecture directe de `storage.objects` n'est ouverte : le
--     fichier reste atteignable par la seule edge function
--     `telecharger-document`, qui relit la ligne avec le jeton de
--     l'appelant — donc sous le §4 — avant de signer une URL de 120 s en
--     `service_role`. `convertir-plan-cad` procède de même (étape 1,
--     client de l'appelant, `403` si la ligne n'est pas lisible) : un
--     géomètre ne pourra plus déclencher la conversion du plan d'un
--     confrère.
--     ⚠️ UNE PREMIÈRE RÉDACTION CONCLUAIT ICI « refermer la table referme
--     le fichier ». C'est vrai d'une ligne HONNÊTE, faux d'une ligne
--     FORGÉE : l'edge function ne valide pas le préfixe du chemin qu'elle
--     signe. Voir le §5 — la clause `url_fichier` referme ce chemin pour
--     les `plan_lot`, mais la faille de l'edge function reste ouverte
--     pour les autres types et doit être portée en dette distincte.
--   · Aucune donnée n'est modifiée, aucun objet supprimé. Les 4 objets
--     orphelins déjà présents sous `plans-cad/` ne sont pas nettoyés :
--     c'est un geste séparé, à décider, et ils n'exposent rien (aucune
--     policy SELECT ne couvre ce préfixe — mesuré : le géomètre lit 0
--     objet storage).
--
--   · ⚪ CE FICHIER N'EST PAS REJOUABLE SUR UNE BASE NEUVE, et ce n'est
--     pas un oubli. Les trois policies qu'il ALTÈRE n'ont jamais été
--     créées par une migration du dépôt : elles datent du chantier du
--     04/07 et n'apparaissent ici que dans un commentaire de
--     20260729170000. Sur une base reconstruite depuis `migrations/`,
--     les trois `alter policy` lèveraient 42704.
--     `alter` a malgré tout été préféré à `drop`+`create` : en
--     PRODUCTION — le seul environnement qui existe — il évite toute
--     fenêtre, même d'une milliseconde, pendant laquelle la table serait
--     sans sa policy, et il conserve le rôle attaché d'origine. Sur un
--     registre foncier, une fenêtre ouverte vaut plus cher qu'un dépôt
--     non rejouable. La dette réelle est ailleurs et déjà numérotée :
--     #27, `supabase_migrations.schema_migrations` s'arrête au
--     `20260723142525`.
-- ---------------------------------------------------------------------
