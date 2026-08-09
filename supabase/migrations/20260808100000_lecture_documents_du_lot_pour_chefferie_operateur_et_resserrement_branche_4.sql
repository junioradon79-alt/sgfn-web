-- =====================================================================
--  OUVRIR la lecture des FICHIERS aux parties, PAR LE LOT — et resserrer
--  dans le meme geste la 4e branche de `peut_lire_documents_lotissement`.
--
--  Consigne d'origine (proprietaire du projet, 29/07/2026), VERBATIM :
--    « Toute attestation generee devra pouvoir etre lisible (simple
--      lecture) par les parties concernees (Operateur, Proprietaire,
--      Acquereur, Chefferie, etc.) En cas de changement de propriete, le
--      cedant ne doit plus pouvoir obtenir des informations sur le bien
--      cede. »
--
--  Les DEUX phrases sont d'egale force. La seconde est tenue depuis les
--  migrations du 30 et du 31/07. Ce fichier traite la premiere SANS
--  toucher a la seconde : mesure faite, il ne rend pas une ligne de plus
--  a un cedant sur un bien cede.
--
-- ---------------------------------------------------------------------
--  L'ANOMALIE TRAITEE
--
--  Le meme acte est lisible par un chemin et invisible par l'autre :
--    * la Chefferie et l'Operateur lisent 106/106 lignes de
--      `attestations_cession` (policies `attcess_chefferie_read`,
--      `attcess_operateur_read`) ;
--    * ils lisent 0 fichier sur 179 dans `documents`.
--  Or le PDF ne s'obtient que par `documents` : l'edge function
--  `telecharger-document` relit la ligne avec le jeton de l'appelant
--  avant de signer l'URL en service_role. La RLS de `documents` est donc
--  l'unique point de controle du fichier.
--
-- ---------------------------------------------------------------------
--  POURQUOI LE BACKFILL DE `documents.lotissement_id` A ETE ECARTE
--
--  La voie « evidente » etait de remplir `documents.lotissement_id` pour
--  que `documents_lotissement_read` (deja en place) fasse le travail.
--  Elle est FAUSSE, pour deux raisons independantes :
--
--   (a) La contrainte `documents_rattachement_exclusif`
--       (20260729170000, `check (lot_id is null or lotissement_id is
--       null)`) l'interdit. `lotissement_id` n'est pas un complement de
--       `lot_id` : c'est un rattachement ALTERNATIF et EXCLUSIF, cree
--       pour le plan de morcellement, qui couvre tout le perimetre et
--       n'a pas de lot. Le NULL sur 179/179 est l'etat CORRECT de la
--       table, pas une dette a rattraper.
--
--   (b) Mesure faite sous contrainte levee, en transaction annulee : ce
--       backfill aurait rendu a AKE AMAFIN NICODEME — cedant reel — 6
--       documents sur ses lots CEDES, dont `ATT-CESS-2026-00881`,
--       nommement le PDF que la migration du 30/07 lui avait retire. Il
--       serait passe de 37 a 159 documents, en gagnant 122 pieces
--       appartenant a 23 autres attributaires. C'est-a-dire l'exact
--       contraire de la seconde phrase de la consigne.
--
--  La cause de (b) est structurelle et merite d'etre nommee, parce
--  qu'elle commande tout le reste de ce fichier : le predicat de
--  lotissement passe par `attributions`. Des qu'un document est visible
--  « au niveau du lotissement », toute personne detenant UN lot dans ce
--  lotissement le voit. C'est une granularite trop grossiere pour porter
--  un acte, qui est par nature l'acte D'UN lot.
--
-- ---------------------------------------------------------------------
--  CE QUE FAIT CE FICHIER — arbitrage du proprietaire du projet (08/08) :
--  « Nouveau predicat par LOT, ET resserrement de la branche 4 dans le
--    meme geste. »
--
--  1. `peut_lire_documents_du_lot(uuid)` — predicat NEUF, par le LOT.
--     Il remonte lot -> ilot -> lotissement et n'autorise QUE la
--     chefferie de la juridiction et l'operateur du parc.
--     🔴 Il ne passe JAMAIS par `attributions`. C'est la propriete qui
--     garantit qu'aucun cedant ne regagne quoi que ce soit : le cedant
--     est une notion d'`attributions`, et cette table n'est pas lue.
--
--  2. `documents_lot_parties_read` — policy NEUVE portant ce predicat.
--
--  3. `peut_lire_documents_lotissement(uuid)` perd sa 4e branche, qui
--     part dans `est_attributaire_actuel_du_lotissement(uuid)` et n'est
--     plus rebranchee que sur le SEUL type `plan_lotissement`.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Le predicat par LOT
--
--  ── Pourquoi PAS de `raise ... errcode 42501` ici ────────────────────
--  Le modele de garde du depot est `registre_supervision()` : une garde
--  qui LEVE, plus un `where` redondant. Il ne s'applique pas a cette
--  fonction-ci, et le dire vaut mieux que de le copier sans reflechir.
--  `registre_supervision()` rend des DONNEES a un appelant identifie :
--  lever y transforme un « il n'y a rien » trompeur en « ce n'est pas
--  pour vous ». Ici, la fonction est un PREDICAT DE POLICY : PostgreSQL
--  l'evalue une fois par ligne de `documents`, pour tout appelant, y
--  compris ceux qui lisent legitimement par une AUTRE branche. Une
--  exception rendrait la table entierement illisible a l'attributaire
--  qui passe par `documents_read` — elle ne fermerait pas une fuite,
--  elle casserait la lecture de tout le monde.
--
--  La double garde est donc portee autrement, et elle est bien double :
--   * dans la fonction : `auth.uid() is not null` ET un `is not null`
--     explicite sur CHAQUE colonne de rattachement ;
--   * dans la policy   : `lot_id is not null`, redondant avec le
--     `p_lot_id is not null` de la fonction.
--
--  ── Les `is not null`, et le piege du 28/07 ──────────────────────────
--  `NULL = NULL` rend NULL, donc faux — mais un seul `is distinct from`
--  ou un `coalesce` mal place suffit a le rendre VRAI, et la lecture
--  s'ouvre alors a TOUS les profils vides. C'est exactement la faille de
--  garde de juridiction du 28/07. Les `is not null` sont donc ecrits, et
--  non deduits.
--
--  ── 🔴 CE QUE CE PREDICAT REND MONNAYABLE (ajout du 09/08, contrôle
--     tiers) ─────────────────────────────────────────────────────────────
--  A partir d'ici, `profiles.autorite_coutumiere_id` et
--  `profiles.operateur_id` ne sont plus de simples champs de rattachement :
--  ils VALENT respectivement 162 et 159 documents en production. Or
--  `profiles_self_update` (role PUBLIC) autorise l'UPDATE sur
--  `id = auth.uid()`, et `authenticated` detient le privilege UPDATE sur la
--  table.
--
--  Ce qui ferme la porte n'est PAS une policy : c'est le trigger
--  `trg_protect_profile_privileged_columns`, qui leve 42501 sur toute
--  modification de ces colonnes par un non-admin. Verifie actif en
--  production le 09/08 (`tgenabled = 'O'`), les deux colonnes figurant
--  nommement dans sa liste.
--
--  La dependance est donc reelle et elle est ecrite ici pour qu'elle cesse
--  d'etre implicite : si ce trigger saute ou perd une de ces deux colonnes,
--  n'importe quel compte authentifie s'octroie le parc d'une chefferie.
--  Toute migration touchant a ce trigger doit relire ce paragraphe.
--
--  ── Volontairement EXCLUS ────────────────────────────────────────────
--   * `est_admin()` : l'admin lit deja tout par `documents_admin_all`.
--     L'ajouter ici creerait une SECONDE regle d'acces admin, appelee a
--     diverger de la premiere.
--   * `attributions` sous toutes ses formes (cf. bandeau ci-dessus).
--   * `anon` : la policy vise `authenticated`, et l'ACL ferme la
--     fonction (§4).
-- ---------------------------------------------------------------------

create or replace function public.peut_lire_documents_du_lot(p_lot_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_lot_id is not null
     and auth.uid() is not null
     and exists (
       select 1
       from lots l
       join ilots i        on i.id  = l.ilot_id
       join lotissements lo on lo.id = i.lotissement_id
       where l.id = p_lot_id
         and (
           -- La CHEFFERIE de la juridiction : c'est elle qui delivre
           -- l'APFC sur ce perimetre et qui signe les actes.
           (    lo.autorite_coutumiere_id is not null
            and lo.autorite_coutumiere_id
                = (select p.autorite_coutumiere_id from profiles p where p.id = auth.uid()))
           or
           -- L'OPERATEUR amenageur a qui le lotissement est confie,
           -- borne a SON parc, comme les 13 RPC du 28/07.
           (    lo.operateur_id is not null
            and lo.operateur_id
                = (select p.operateur_id from profiles p where p.id = auth.uid()))
         )
     );
$function$;

comment on function public.peut_lire_documents_du_lot(uuid) is
  'Vrai si l''appelant est la chefferie de la juridiction OU l''operateur du parc dont releve CE lot (lot -> ilot -> lotissement). Ne lit JAMAIS `attributions` : c''est ce qui garantit qu''un cedant ne regagne rien sur un bien cede. Ne dit rien du droit d''ecrire — le depot reste admin.';


-- ---------------------------------------------------------------------
--  2. La 4e branche de `peut_lire_documents_lotissement`, extraite
--
--  ── CE QU'ELLE EST CENSEE SERVIR ─────────────────────────────────────
--  Motif d'origine (20260729170000) : « l'ATTRIBUTAIRE d'au moins un lot
--  du lotissement — le plan de morcellement est la piece qui situe sa
--  parcelle ». Ce motif est REEL et il a un consommateur vivant :
--  `/lotissements/[id]` est ouvert au role `proprietaire_terrien`
--  (`src/lib/navigation.ts`), la page monte `PlanLotissementCard`, et ce
--  composant est le SEUL endroit du depot qui lise `documents` par
--  `lotissement_id` — via `getPlansLotissement`, qui filtre deja
--  `.eq("type", "plan_lotissement")`.
--
--  ── POURQUOI ELLE EST UNE FUITE MALGRE TOUT ──────────────────────────
--  Son parametre est le LOTISSEMENT, pas le lot. UNE seule attribution
--  actuelle sur UN lot suffit a ouvrir TOUS les documents portant ce
--  `lotissement_id`. Et la contrainte
--  `documents_plan_lotissement_rattache` impose bien qu'un
--  `plan_lotissement` porte un `lotissement_id`, mais elle N'INTERDIT
--  PAS l'inverse : une quittance, un certificat de propriete coutumiere
--  ou un PV peuvent parfaitement etre rattaches au lotissement. Le jour
--  ou cela arrive, 898 attributaires les lisent.
--  Elle rend deja `true` pour AKE aujourd'hui ; seule l'absence de ligne
--  portant un `lotissement_id` (0 sur 179) la rend inoffensive.
--
--  ── L'ARBITRAGE : RESSERRER, PAS SUPPRIMER ───────────────────────────
--  Supprimer aurait ete defendable — la branche vaut 0 ligne
--  aujourd'hui. Elle est pourtant CONSERVEE, sous condition, parce que :
--   * le besoin est reel et indivisible : un plan de morcellement couvre
--     849 lots, il n'en existe pas de version « par lot ». Pour CE
--     document, « un lot ouvre le lotissement » n'est pas une
--     granularite trop large, c'est la seule qui existe ;
--   * la supprimer denierait silencieusement l'ecran ci-dessus au
--     premier plan depose — un refus que rien n'afficherait, puisqu'une
--     policy SELECT non satisfaite rend 0 ligne sans erreur ;
--   * le danger reel n'est pas la branche, c'est son absence de borne de
--     TYPE. La borne coute exactement zero au depot, verifie : le seul
--     consommateur filtre deja sur `plan_lotissement`.
--
--  Elle est donc extraite dans sa propre fonction, et rebranchee dans la
--  policy UNIQUEMENT en conjonction avec `type = 'plan_lotissement'`.
--  Apres ce fichier, un attributaire lit le plan de morcellement de son
--  lotissement, et RIEN d'autre qui y serait rattache.
--
--  `and a.actuel` est conserve tel quel : c'est le correctif du 30/07,
--  celui qui sort le cedant. Le retirer rouvrirait la fuite 3.
-- ---------------------------------------------------------------------

create or replace function public.est_attributaire_actuel_du_lotissement(p_lotissement_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_lotissement_id is not null
     and auth.uid() is not null
     and exists (
       select 1
       from attributions a
       join lots l  on l.id = a.lot_id
       join ilots i on i.id = l.ilot_id
       where i.lotissement_id = p_lotissement_id
         and a.actuel
         and a.attributaire_id is not null
         and a.attributaire_id
             = (select p.attributaire_id from profiles p where p.id = auth.uid())
     );
$function$;

comment on function public.est_attributaire_actuel_du_lotissement(uuid) is
  'Ex-4e branche de peut_lire_documents_lotissement(), extraite le 08/08/2026. Vrai si l''appelant detient ACTUELLEMENT au moins un lot du lotissement. A n''utiliser que conjointement a une borne de TYPE de document : seule est defendable la lecture du plan de morcellement, piece indivisible qui situe sa parcelle. Portee sur tout autre type, elle ouvrirait le lotissement entier a 898 attributaires.';


-- ---------------------------------------------------------------------
--  3. `peut_lire_documents_lotissement` : 4 branches -> 3
--
--  Signature INCHANGEE, a dessein. La changer aurait impose un
--  drop+create alors que `documents_lotissement_read` en depend (le drop
--  aurait echoue), et aurait casse les 24 appels de
--  `scripts/e2e-plan-lotissement.sql`. Ne restent que les trois lecteurs
--  INCONDITIONNELS — ceux dont le droit ne depend pas du type de piece.
-- ---------------------------------------------------------------------

create or replace function public.peut_lire_documents_lotissement(p_lotissement_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_lotissement_id is not null and (
    public.est_admin()
    or exists (
      select 1 from lotissements lo
      where lo.id = p_lotissement_id
        and lo.autorite_coutumiere_id is not null
        and lo.autorite_coutumiere_id
            = (select p.autorite_coutumiere_id from profiles p where p.id = auth.uid())
    )
    or exists (
      select 1 from lotissements lo
      where lo.id = p_lotissement_id
        and lo.operateur_id is not null
        and lo.operateur_id
            = (select p.operateur_id from profiles p where p.id = auth.uid())
    )
    -- 4e branche (attributaire) RETIREE le 08/08/2026 : deplacee dans
    -- `est_attributaire_actuel_du_lotissement()`, et rebranchee dans la
    -- policy sous la seule condition `type = 'plan_lotissement'`.
  );
$function$;

comment on function public.peut_lire_documents_lotissement(uuid) is
  'Lecteurs INCONDITIONNELS des pieces d''un lotissement : admin, chefferie de la juridiction, operateur du parc. La 4e branche (attributaire d''un lot) en a ete retiree le 08/08/2026 — son parametre etant le lotissement et non le lot, une seule attribution actuelle ouvrait TOUT ce qui porte ce lotissement_id. Elle vit desormais dans est_attributaire_actuel_du_lotissement(), bornee au type plan_lotissement par la policy documents_lotissement_read.';


-- ---------------------------------------------------------------------
--  4. ACL — le defaut de ce projet est cable vers PUBLIC
--
--  🔴 `revoke ... from public` NE SUFFIT PAS. Le projet porte un
--  `alter default privileges ... grant all on functions to anon,
--  authenticated, service_role` : une fonction NEUVE nait avec un grant
--  NOMME a `anon`, que revoquer PUBLIC ne touche pas. D'ou `from public,
--  anon` sur les trois, y compris celles qui ne font qu'etre remplacees
--  (idempotent, et la migration reste rejouable sans dependre de l'ACL
--  en place).
--
--  L'event trigger `evt_fonctions_neuves_fermees_a_anon` va se declencher
--  sur chaque `create or replace function` ci-dessus : c'est voulu, on ne
--  le desarme pas. Il ne retire que l'aclitem PUBLIC, jamais un grant
--  nomme, donc les `grant ... to authenticated` qui suivent survivent.
--
--  Le controle horaire `securite-exposition-anon` doit continuer a rendre
--  0 ecart : aucune des deux fonctions NEUVES n'est accordee a `anon`,
--  elles n'entrent donc dans aucune des listes de reference de
--  20260730040000 / 050000, qui n'enumerent que ce qui est atteignable
--  par `anon`. Aucune ligne de base a mettre a jour.
-- ---------------------------------------------------------------------

revoke all on function public.peut_lire_documents_du_lot(uuid)             from public, anon;
revoke all on function public.est_attributaire_actuel_du_lotissement(uuid) from public, anon;
revoke all on function public.peut_lire_documents_lotissement(uuid)        from public, anon;

grant execute on function public.peut_lire_documents_du_lot(uuid)             to authenticated;
grant execute on function public.est_attributaire_actuel_du_lotissement(uuid) to authenticated;
grant execute on function public.peut_lire_documents_lotissement(uuid)        to authenticated;


-- ---------------------------------------------------------------------
--  5. La policy neuve — et POURQUOI une policy neuve
--
--  Une branche ajoutee a `documents_read` aurait produit le meme
--  resultat logique (les policies permissives sont OU-ees). Trois
--  raisons de ne pas le faire :
--
--   (a) `documents_read` est attachee au role `public`, donc AUSSI a
--       `anon`. La policy neuve vise `authenticated` : `anon` reste hors
--       de son champ, exactement comme pour `documents_lotissement_read`.
--
--       🔴 RECTIFICATION DU 09/08/2026, par contrôle tiers. Cette clause
--       affirmait qu'y brancher une fonction fermee a `anon` « changerait,
--       pour lui, un refus en une ERREUR 42501 ». C'EST FAUX, et mesure
--       comme tel par emprunt du role : `set local role anon; select
--       count(*) from documents;` leve DEJA
--           ERROR 42501: permission denied for function lot_ids_chefferie
--       `documents_read` evalue son `exists ... from attributions`, ce qui
--       declenche `attributions_read` (PUBLIC elle aussi), dont le `qual`
--       appelle `lot_ids_chefferie()` — fermee a `anon` depuis
--       20260731110000. Il n'y avait donc aucun « refus silencieux » a
--       preserver : `anon` ne recoit pas 0 ligne sur cette table, il
--       recoit une erreur, et c'est fail-closed.
--
--       L'arbitrage reste le bon, mais pour les raisons (b) et (c) SEULES.
--       Ne pas rejouer l'argument (a) : un lecteur futur s'y fierait.
--
--       Corollaire a connaitre, hors perimetre de ce fichier : toute
--       lecture anonyme de `documents` depuis le front rend une ERREUR,
--       pas une liste vide.
--
--   (b) `documents_read` est la policy que le 30/07 a RESSERREE pour
--       fermer la fuite du cedant (`and a.actuel`). La reecrire pour y
--       glisser une branche obligerait a re-emettre integralement
--       l'expression qui porte cette fermeture. Une faute de frappe a
--       cet endroit precis rouvre la fuite sans que rien ne le signale.
--       Ne pas y toucher laisse la fermeture du 30/07 en place au
--       caractere pres — et c'est verifiable : le `qual` de
--       `documents_read` doit etre IDENTIQUE avant et apres ce fichier.
--
--   (c) Une regle d'ouverture qui vit dans son propre objet se retire
--       d'un seul `drop policy`, sans toucher a une regle de fermeture.
--
--  Le `lot_id is not null` est redondant avec la garde de la fonction.
--  Il est ecrit quand meme : c'est la seconde moitie de la double garde
--  du §1, et il evite un appel de fonction sur les 17 lignes sans
--  rattachement.
--
--  AUCUNE policy d'ecriture n'est creee. `documents_admin_all` reste la
--  seule voie de depot. Une chefferie ou un operateur qui tente un
--  insert ne recoit aucune erreur — il touche 0 ligne.
-- ---------------------------------------------------------------------

drop policy if exists documents_lot_parties_read on public.documents;
create policy documents_lot_parties_read
  on public.documents
  for select
  to authenticated
  using (
    lot_id is not null
    and public.peut_lire_documents_du_lot(lot_id)
  );


-- ---------------------------------------------------------------------
--  6. `documents_lotissement_read` : la borne de TYPE
--
--  `alter policy` et non `drop`+`create` : pas de fenetre, meme courte,
--  pendant laquelle la table serait sans cette policy.
-- ---------------------------------------------------------------------

alter policy documents_lotissement_read on public.documents
using (
  lotissement_id is not null
  and (
    public.peut_lire_documents_lotissement(lotissement_id)
    or (
      type = 'plan_lotissement'::public.type_document
      and public.est_attributaire_actuel_du_lotissement(lotissement_id)
    )
  )
);
