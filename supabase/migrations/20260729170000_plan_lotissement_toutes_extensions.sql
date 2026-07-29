-- =====================================================================
--  Plan de morcellement : loger un document au niveau du LOTISSEMENT,
--  et le restituer dans le format exact où il a été déposé.
--
--  ── CE QUI MANQUAIT ──────────────────────────────────────────────────
--  L'enum `type_document` porte la valeur `plan_lotissement` depuis
--  l'origine, mais `public.documents` n'a de clé étrangère que vers
--  `lots(id)`. Un plan de morcellement couvre TOUT le périmètre (849 lots
--  pour Brignan Kakodji) : le rattacher à un lot serait faux, et le
--  rattacher aux 849 serait 849 fois le même fichier. La valeur d'enum
--  existait donc sans logement possible — 0 ligne de ce type en base.
--
--  ── « CONSERVER TOUTES LES EXTENSIONS » ──────────────────────────────
--  Demande explicite de l'utilisateur (29/07). Le bucket `documents` est
--  déjà sans restriction MIME ni limite de taille : il accepte n'importe
--  quel format. Ce qui manquait, c'est de quoi RENDRE le fichier tel
--  qu'il a été déposé — d'où `nom_fichier`, `type_mime`, `taille_octets`.
--  La clé de stockage, elle, reste normalisée (`<id>.<ext>`) : y écrire
--  le nom d'origine exposerait la clé aux espaces, accents et « # » que
--  l'API Storage n'accepte pas également selon les clients. Le nom réel
--  vit en colonne, la clé reste technique. Mêmes noms de colonnes que
--  `conversation_documents`, qui résout déjà ce problème dans ce dépôt.
--
--  ⚠️ Ce fichier n'ouvre AUCUNE écriture au-delà de `est_admin()`. Le
--  dépôt reste admin ; seule la LECTURE est élargie, et explicitement
--  bornée. Les fuites du 24/07 et du 28/07 venaient toutes d'une lecture
--  ouverte avant que l'écriture ne soit bornée.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
--  1. Colonnes
-- ─────────────────────────────────────────────────────────────────────

alter table public.documents
  add column if not exists lotissement_id uuid
    references public.lotissements(id) on delete cascade,
  add column if not exists nom_fichier   text,
  add column if not exists type_mime     text,
  add column if not exists taille_octets bigint;

comment on column public.documents.lotissement_id is
  'Rattachement au niveau du lotissement (plan de morcellement, guide…). Exclusif de lot_id.';
comment on column public.documents.nom_fichier is
  'Nom de fichier ORIGINAL, extension comprise, tel que deposé. La clé de stockage (url_fichier) est normalisée ; c''est ce nom-ci qui est restitué au téléchargement.';
comment on column public.documents.type_mime is
  'Type MIME annoncé par le navigateur au dépôt. Décide de l''aperçu (PDF/image) ou du téléchargement fidèle. Peut être vide : un .dxf ou un .shp n''a pas de type MIME connu.';
comment on column public.documents.taille_octets is
  'Taille au dépôt. Sert à annoncer le poids avant un téléchargement — un plan CAO se compte en dizaines de Mo — et à repérer un envoi tronqué.';

create index if not exists idx_documents_lotissement_id
  on public.documents(lotissement_id);

-- ─────────────────────────────────────────────────────────────────────
--  2. Contraintes de rattachement — et ce qu'on s'interdit d'imposer
--
--  (a) EXCLUSIVITÉ. Les deux rattachements ne peuvent pas coexister.
--      Motif : `lot_id` détermine déjà le lotissement par
--      lots → ilots → lotissements. Autoriser les deux ferait exister
--      des lignes où `lotissement_id` contredit ce chemin, sans qu'aucun
--      code ne dise laquelle des deux valeurs fait foi.
--
--  (b) PAS de « au moins un rattachement ». 17 des 74 lignes actuelles
--      n'en portent aucun (quittances, APFC, PV de bornage produits par
--      le système, retrouvés par leur `url_fichier`). Imposer la règle
--      aurait exigé soit de la déclarer `not valid` — c'est-à-dire de
--      l'écrire sans qu'elle décrive la table —, soit de rattacher 17
--      lignes à l'aveugle. Aucun des deux n'est honnête.
--
--  (c) En revanche, la règle EST imposée là où le chantier la crée :
--      un `plan_lotissement` sans `lotissement_id` n'a aucun sens, et
--      aucune ligne existante n'est de ce type. La contrainte est donc
--      vérifiée sur la table réelle, pas repoussée.
-- ─────────────────────────────────────────────────────────────────────

alter table public.documents
  drop constraint if exists documents_rattachement_exclusif;
alter table public.documents
  add constraint documents_rattachement_exclusif
  check (lot_id is null or lotissement_id is null);

alter table public.documents
  drop constraint if exists documents_plan_lotissement_rattache;
alter table public.documents
  add constraint documents_plan_lotissement_rattache
  check (type <> 'plan_lotissement'::type_document or lotissement_id is not null);

-- ─────────────────────────────────────────────────────────────────────
--  3. Qui peut LIRE un document de lotissement
--
--  Prédicat unique, SECURITY DEFINER. Deux raisons de ne pas écrire les
--  sous-requêtes directement dans la policy :
--   · une policy évalue ses sous-requêtes sous la RLS de l'appelant. Le
--     fait « cet utilisateur est attributaire dans ce lotissement » doit
--     être VRAI ou FAUX, pas « vrai si la RLS de `attributions` veut
--     bien le lui montrer » ;
--   · un prédicat nommé s'appelle directement en test — la garde se
--     prouve sans passer par un `select` sur `documents`.
--
--  Trois lecteurs, chacun avec son motif :
--   · la CHEFFERIE dont dépend le lotissement — c'est elle qui délivre
--     l'APFC sur ce périmètre ;
--   · l'OPÉRATEUR aménageur à qui le lotissement est confié — borné à
--     SON parc, comme les 13 RPC du 28/07 ;
--   · l'ATTRIBUTAIRE d'au moins un lot du lotissement — le plan de
--     morcellement est la pièce qui situe sa parcelle.
--
--  Volontairement EXCLUS, et pourquoi :
--   · `anon` : la policy vise `authenticated`. `lotissements` est
--     lisible publiquement, mais c'est la fiche, pas les pièces.
--   · tout authentifié : ce serait une lecture nationale déguisée.
--   · le GÉOMÈTRE : `documents_geometre_plans_read` lui ouvre déjà TOUS
--     les `plan_lot` du pays sans le moindre scope. Étendre ce modèle au
--     plan de morcellement recopierait le défaut au lieu de le corriger.
--     Rien n'attache aujourd'hui un géomètre à un lotissement.
--
--  Chaque égalité est gardée par un `is not null` explicite : sur un
--  profil sans autorité ni opérateur, `NULL = NULL` doit rester faux.
--  (`is not distinct from` aurait rendu VRAI et ouvert la lecture à tous
--  les profils vides — c'est la forme exacte du piège du 28/07.)
-- ─────────────────────────────────────────────────────────────────────

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
    or exists (
      select 1
      from attributions a
      join lots l  on l.id = a.lot_id
      join ilots i on i.id = l.ilot_id
      where i.lotissement_id = p_lotissement_id
        and a.attributaire_id is not null
        and a.attributaire_id
            = (select p.attributaire_id from profiles p where p.id = auth.uid())
    )
  );
$function$;

comment on function public.peut_lire_documents_lotissement(uuid) is
  'Vrai si l''appelant a un motif établi de lire les pièces de ce lotissement : admin, chefferie de la juridiction, opérateur du parc, ou attributaire d''un lot. Ne dit rien du droit d''écrire — le dépôt reste admin.';

-- 🔴 `revoke … from public` NE SUFFIT PAS ici. Le projet porte un
-- `alter default privileges … grant all on functions to anon, authenticated,
-- service_role` : toute fonction nouvellement créée reçoit un grant NOMMÉ à
-- `anon`, que révoquer PUBLIC ne touche pas. Relevé par le contrôle 24 du
-- script e2e, qui rendait `anon=true` au premier passage.
revoke all on function public.peut_lire_documents_lotissement(uuid) from public, anon;
grant execute on function public.peut_lire_documents_lotissement(uuid) to authenticated;

drop policy if exists documents_lotissement_read on public.documents;
create policy documents_lotissement_read
  on public.documents
  for select
  to authenticated
  using (
    lotissement_id is not null
    and public.peut_lire_documents_lotissement(lotissement_id)
  );

-- Aucune policy d'écriture n'est créée : `documents_admin_all` (ALL,
-- est_admin()) reste la seule voie de dépôt. Une chefferie, un opérateur
-- ou un attributaire qui tente un insert ne reçoit AUCUNE erreur — il
-- touche 0 ligne. C'est ce que le script de contrôle mesure, ligne par
-- ligne, plutôt que de se fier à l'absence d'exception.

-- ─────────────────────────────────────────────────────────────────────
--  4. Le fichier lui-même (bucket privé `documents`)
--
--  Dépôt sous le préfixe `plans-lotissement/`, réservé à l'admin.
--
--  La lecture du fichier passe, pour TOUT RÔLE NON-ADMIN, exclusivement
--  par l'edge function `telecharger-document`, qui lit d'abord la ligne
--  avec le jeton de l'appelant (donc sous la RLS ci-dessus) avant de
--  signer une URL de 120 s en service_role. Chefferie, opérateur et
--  attributaire n'ont donc aucun accès direct à `storage.objects` : une
--  seule règle d'accès, celle de la table.
--
--  🔴 UNE POLICY SELECT ADMIN EST MALGRÉ TOUT NÉCESSAIRE — corrigé après
--  coup. Première version : aucune policy SELECT du tout, au motif
--  qu'une seconde règle de lecture finit toujours par diverger de la
--  première. Conséquence constatée en production : les 21 objets déposés
--  par les contrôles e2e sont restés dans le bucket alors que leurs
--  lignes avaient bien été supprimées. `storage.remove()` fait un
--  LOOKUP de l'objet avant de le détruire ; sans droit de lecture, il ne
--  trouve rien et ne supprime rien — en répondant « ok ». La suppression
--  n'échouait pas, elle ne faisait rien.
--  La policy est donc bornée à `est_admin()`, ce qui n'ouvre aucune
--  seconde voie : l'admin lit déjà tout par `documents_admin_all`, et
--  les rôles pour lesquels les deux règles pourraient diverger — les
--  trois du §3 — restent, eux, sans aucun accès direct.
--
--  🔴 Constat de passage : `LotissementForm.tsx` téléverse depuis le
--  22/07 le scan du PV d'identification physique sous
--  `pv-identification-physique/…`, préfixe qu'AUCUNE policy ne couvre.
--  Le bucket compte 0 objet sous ce préfixe : cet envoi n'a jamais
--  abouti, et l'écran affichait l'échec dans un `<p>` sans plus. Ce
--  n'est pas l'objet de ce chantier — c'est signalé, pas corrigé ici.
-- ─────────────────────────────────────────────────────────────────────

drop policy if exists documents_plans_lotissement_insert on storage.objects;
create policy documents_plans_lotissement_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'plans-lotissement'
    and public.est_admin()
  );

drop policy if exists documents_plans_lotissement_delete on storage.objects;
create policy documents_plans_lotissement_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'plans-lotissement'
    and public.est_admin()
  );

-- Lecture directe : ADMIN SEUL, et uniquement pour que la suppression
-- ci-dessus puisse retrouver son objet (cf. le bandeau plus haut).
drop policy if exists documents_plans_lotissement_admin_read on storage.objects;
create policy documents_plans_lotissement_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'plans-lotissement'
    and public.est_admin()
  );

-- ─────────────────────────────────────────────────────────────────────
--  5. /verifier — branche APFC
--
--  Corps repris intégralement de `pg_get_functiondef` en production le
--  29/07 (la fonction a 5 branches et a été remaniée les 22, 23 et
--  29/07 ; la réécrire de mémoire en perdrait une). SEULE addition : la
--  clé `plan_morcellement_depose` dans la branche `apfc`.
--
--  Un BOOLÉEN, et rien d'autre. Pas d'identifiant, pas d'URL, pas de
--  titre : la page est publique et anonyme. Le fait qu'un plan de
--  morcellement soit versé au registre est un signal de confiance de
--  même nature que le n° de PV d'identification physique déjà exposé
--  juste à côté ; le plan lui-même reste derrière la RLS du §3.
--
--  ── CE QU'ON NE FAIT PAS : toucher au SCORE DE CONFIANCE ────────────
--  Le score n'est pas un indicateur, c'est une VANNE :
--   · `lot_peut_emettre_attestation_niveau1` compare les composantes à
--     des littéraux (`= 40`, `= 20`, `= 20`). Repondérer pour loger un
--     5ᵉ critère à somme constante rendrait ces trois tests faux pour
--     TOUS les lotissements, sans erreur — l'émission Niveau 1
--     s'arrêterait en silence.
--   · `lot_peut_emettre_attestation_niveau2` teste `>= 100`. Ajouter 20
--     points sans repondérer porte le maximum à 120 : « 100 » cesserait
--     de signifier « dossier complet », et `message_refus_documentaire`
--     continuerait d'écrire « %s/100 » sous les yeux de l'utilisateur.
--  Le plan de morcellement est une pièce de référence, pas une des
--  quatre pièces dont la loi fait dépendre l'émission. Il est donc
--  exposé À CÔTÉ du score, jamais dedans.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.verifier_document(p_ref text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_lot_id uuid;
  v_attrib_ref text;
begin
  if exists (select 1 from attestations_cession where reference = p_ref or qr_token = p_ref) then
    -- Redirection transparente : si le lot a ete promu Niveau 2/3 depuis,
    -- l'ancien QR affiche directement l'etat ACTUEL (meme reference papier,
    -- contenu a jour) -- decision actee du 23/07, pas de bandeau separe.
    select lot_id into v_lot_id from attestations_cession where reference = p_ref or qr_token = p_ref;
    select reference into v_attrib_ref from attestations_attribution_lot where lot_id = v_lot_id;
    if v_attrib_ref is not null then
      return jsonb_build_object('type_document', 'attestation_attribution') || public.verifier_attestation_attribution(v_attrib_ref);
    end if;

    select jsonb_build_object('type_document', 'attestation_cession') || public.verifier_attestation(p_ref) into v_result;
    return v_result;
  end if;

  if exists (select 1 from attestations_attribution_lot where reference = p_ref or qr_token = p_ref) then
    return jsonb_build_object('type_document', 'attestation_attribution') || public.verifier_attestation_attribution(p_ref);
  end if;

  if exists (select 1 from certificats_vente where reference = p_ref or qr_token = p_ref) then
    return (
      with cv as (select * from certificats_vente where reference = p_ref or qr_token = p_ref),
      lot as (select l.* from lots l join cv on cv.lot_id = l.id),
      lo as (
        select ilo.numero as ilot, lt.nom as lotissement, lt.commune, lt.village
        from lot
        join ilots ilo on ilo.id = lot.ilot_id
        join lotissements lt on lt.id = ilo.lotissement_id
      )
      select jsonb_build_object(
        'type_document', 'certificat_vente',
        'reference', (select reference from cv),
        'statut_document', (select statut from cv),
        'acquereur', (select nom from attributaires where id = (select acquereur_id from cv)),
        'lot', (select numero_lot from lot),
        'ilot', (select ilot from lo),
        'lotissement', (select lotissement from lo),
        'commune', (select commune from lo),
        'village', (select village from lo),
        'statut_litige', coalesce((select statut::text from litiges where lot_id = (select id from lot) and statut <> 'clos' limit 1), 'aucun'),
        'score_confiance', public.score_confiance_lot((select id from lot))
      )
    );
  end if;

  if exists (select 1 from attestations_coutumieres where reference = p_ref or numero = p_ref) then
    return (
      with apfc as (select * from attestations_coutumieres where reference = p_ref or numero = p_ref),
      lo as (select lt.* from lotissements lt join apfc on apfc.lotissement_id = lt.id)
      select jsonb_build_object(
        'type_document', 'apfc',
        'reference', (select reference from apfc),
        'statut_document', (select statut::text from apfc),
        'date_delivrance', (select date_delivrance from apfc),
        'non_contestation_imprimee', (select non_contestation from apfc),
        'lotissement', (select nom from lo),
        'village', (select village from lo),
        'commune', (select commune from lo),
        'district', (select district from lo),
        'superficie', (select superficie_texte from lo),
        'nb_ilots', (select nb_ilots from lo),
        'nb_lots', (select nb_lots from lo),
        'famille', (select nom from familles where id = (select famille_id from apfc)),
        'lignee', (select f2.nom from familles f2 where f2.id = (select lignee_id from familles where id = (select famille_id from apfc))),
        'chef_de_famille', coalesce((select chef_de_famille from apfc), (select chef_de_famille from familles where id = (select famille_id from apfc))),
        'autorite_coutumiere', (select nom from autorites_coutumieres where id = (select autorite_coutumiere_id from apfc)),
        -- 🔴 LISAIT `autorites_coutumieres.chef`, c'est-à-dire le chef COURANT.
        -- Un document de 2022 se retrouvait signé, aux yeux du public, par un
        -- chef nommé en 2023. Résolu par la date de délivrance de l'acte.
        'autorite_chef', (
          select c.nom from public.chef_autorite_a_la_date(
            (select autorite_coutumiere_id from apfc),
            (select date_delivrance from apfc)
          ) c
        ),
        'guide_reference', (select lo.guide_reference from lo),
        'guide_page_min', (select min(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'guide_page_max', (select max(l3.guide_page) from lots l3 join ilots i3 on i3.id = l3.ilot_id where i3.lotissement_id = (select id from lo)),
        'pv_numero_enregistrement', (select pv_numero_enregistrement from lo),
        'pv_commissaire_nom', (select nom from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'pv_commissaire_etude', (select etude from commissaires_justice where id = (select pv_commissaire_justice_id from lo)),
        'pv_identification_physique_numero', (select pv_identification_physique_numero from lo),
        'pv_identification_physique_date', (select pv_identification_physique_date from lo),
        -- Ajout 29/07 : présence du plan de morcellement au registre. Booléen
        -- seul — la page est publique, le fichier reste derrière la RLS.
        'plan_morcellement_depose', (
          select exists (
            select 1 from documents d
            where d.lotissement_id = (select id from lo)
              and d.type = 'plan_lotissement'::type_document
          )
        ),
        'litiges_actifs', (
          select coalesce(jsonb_agg(jsonb_build_object('lot', l2.numero_lot, 'ilot', i2.numero, 'objet', lit.objet, 'statut', lit.statut, 'ouvert_le', lit.ouvert_le)), '[]'::jsonb)
          from litiges lit
          join lots l2 on l2.id = lit.lot_id
          join ilots i2 on i2.id = l2.ilot_id
          where i2.lotissement_id = (select id from lo) and lit.statut <> 'clos'
        ),
        'nb_attestations_emises', (select count(*) from attestations_cession where apfc_id = (select id from apfc))
      )
    );
  end if;

  if exists (select 1 from pv_bornage where reference = p_ref or qr_token = p_ref) then
    return (
      with pv as (select * from pv_bornage where reference = p_ref or qr_token = p_ref),
      m as (select * from missions_geometre where id = (select mission_id from pv)),
      ge as (select * from geometres_experts where id = (select geometre_id from m)),
      lot as (select * from lots where id = (select lot_id from m)),
      lo as (
        select ilo.numero as ilot, lt.nom as lotissement, lt.commune, lt.village
        from lot
        join ilots ilo on ilo.id = lot.ilot_id
        join lotissements lt on lt.id = ilo.lotissement_id
      )
      select jsonb_build_object(
        'type_document', 'pv_bornage',
        'reference', (select reference from pv),
        'statut_document', (select statut::text from pv),
        'geometre', (select nom from ge),
        'geometre_cabinet', (select cabinet from ge),
        'geometre_numero_ordre', (select numero_ordre from ge),
        'client', (select client_nom from m),
        'lieu', (select lieu from m),
        'lot', (select numero_lot from lot),
        'ilot', (select ilot from lo),
        'lotissement', (select lotissement from lo),
        'commune', (select commune from lo),
        'village', (select village from lo),
        'date_bornage', (select date_bornage from pv),
        'superficie_mesuree_m2', (select superficie_mesuree_m2 from pv),
        'superficie_enregistree_m2', (select superficie_m2 from lot),
        'sig_demandeur', (select sig_demandeur_le is not null from pv),
        'sig_geometre', (select sig_geometre_le is not null from pv),
        'sig_autorite', (select sig_autorite_le is not null from pv)
      )
    );
  end if;

  return jsonb_build_object('type_document', null);
end;
$function$;
