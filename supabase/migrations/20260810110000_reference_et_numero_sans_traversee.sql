-- =====================================================================
--  DETTE #49 — LE JUMEAU EN ECRITURE : `reference` et `numero` NE
--  DOIVENT PAS POUVOIR COMPOSER UN CHEMIN DE STOCKAGE ARBITRAIRE
--
--  ── LE DEFAUT, TROUVE LE 10/08 DANS LE FICHIER QU'ON VENAIT DE CORRIGER
--  `supabase/functions/generation-document/index.ts:813-814` :
--      const chemin = `${table}/${rec.reference ?? rec.numero ?? rec.id}.${e}`;
--      await supabase.storage.from("documents")
--        .upload(chemin, b, { contentType: m, upsert: true });
--
--  `rec` vient d'un trigger, donc de la base — ce qui rassure a tort. Sur
--  `pv_bornage`, `reference` est ENTIEREMENT FOURNIE PAR LE CLIENT. Relu
--  en catalogue le 10/08 :
--    · `reference text NOT NULL`, aucun defaut ;
--    · AUCUN CHECK de forme sur la table ;
--    · AUCUN trigger BEFORE qui la fabrique — contrairement a `paiements`,
--      qui a `trg_reference_quittance` ;
--    · policy `pv_bornage_owner_all` : son predicat ne contraint QUE
--      `mission_id` ;
--    · `missions_geometre_owner_all` : `geometre_id = mon_geometre_id()`,
--      donc le geometre cree lui-meme la mission qui l'autorise ;
--    · grants INSERT sur `pv_bornage` ET `missions_geometre` : `anon`,
--      `authenticated`, `service_role`.
--
--  La chaine, telle qu'elle etait ouverte :
--    ① le geometre insere sa mission, puis un `pv_bornage` avec
--       reference = '../attestations_cession/ATT-CESS-2026-00846.pdf#'
--    ② le trigger appelle `generation-document`, qui construit
--       "pv_bornage/../attestations_cession/ATT-CESS-2026-00846.pdf#.html"
--    ③ `upload(..., { upsert: true })` en `service_role` ; le parseur
--       d'URL normalise `..` et tronque au `#`, et l'objet REELLEMENT
--       ECRASE est "attestations_cession/ATT-CESS-2026-00846.pdf".
--  → le PDF d'une attestation reelle est remplace par un faux, et la
--  verification QR continue de repondre « authentique ».
--
--  Latent au 10/08 : `missions_geometre` porte 0 ligne et le seul compte
--  `geometre` est un compte de demonstration. Ouvert au premier usage
--  normal du module.
--
--  ── POURQUOI EN BASE ALORS QUE LA FONCTION EST DEJA CORRIGEE ─────────
--  `generation-document` valide desormais le chemin avant de televerser.
--  Ni cette garde ni cette contrainte ne suffit seule :
--    · la fonction peut etre redeployee, ou une AUTRE fonction peut lire
--      les memes colonnes pour composer un chemin ;
--    · la base, elle, ne connait pas le gabarit — elle ne peut que
--      garantir que la MATIERE PREMIERE est saine.
--  Les deux etages ferment des choses differentes, et c'est voulu.
--
--  ── 🔴 LES TROIS COLONNES, PAS DEUX ──────────────────────────────────
--  Le gabarit lit `rec.reference ?? rec.numero ?? rec.id`. La lecon du
--  09/08 (une colonne voisine oubliee rouvre tout) s'applique mot pour
--  mot : les TROIS sont balayees.
--    · `reference` : contrainte ci-dessous sur les 6 tables qui en ont une.
--    · `numero`    : contrainte ci-dessous — seule `attestations_coutumieres`
--                    en porte une (relu en catalogue).
--    · `id`        : de type `uuid`. PostgreSQL n'accepte dans un uuid que
--                    des hexadecimaux et des tirets ; il ne peut porter ni
--                    `/`, ni `.`, ni `#`. AUCUNE contrainte n'est donc
--                    ecrite pour lui, et c'est un choix argumente, pas un
--                    oubli — c'est le type qui fait la garde.
--
--  ── MESURE AVANT (10/08/2026, production, lecture seule) ─────────────
--  Valeurs existantes des colonnes visees, contre le motif impose :
--      attestations_cession.reference          106 valeurs, 0 hors motif
--      attestations_coutumieres.reference        1 valeur,  0 hors motif
--      attestations_coutumieres.numero           1 valeur,  0 hors motif
--      attestations_attribution_lot.reference    0 valeur (table vide)
--      certificats_vente.reference               0 valeur (table vide)
--      paiements.reference                       0 valeur (table vide)
--      pv_bornage.reference                      0 valeur (table vide)
--                                              ---------------------------
--                                              108 valeurs, 0 REFUSEE
--  Cout de la fermeture : NUL. Aucune ligne n'est reecrite, aucune n'est
--  supprimee, ce fichier ne touche pas une donnee.
--
--  ── LE MOTIF, ET POURQUOI IL EST PLUS STRICT QUE CELUI DES CHEMINS ───
--  `^[A-Za-z0-9._-]+$` : une reference est un IDENTIFIANT D'ACTE
--  (`ATT-CESS-2026-00846`, `APFC-EBIMPE-2022-001`, `QUIT-2026-00014`), pas
--  un chemin. Elle n'a aucune raison de porter `/`, et le lui interdire
--  est plus fort que de bannir `..` : sans `/`, aucune traversee n'est
--  exprimable, quelle que soit la normalisation appliquee en aval.
--  Les 108 valeurs reelles y entrent toutes.
--
--  `..` reste banni explicitement bien que compose de caracteres
--  autorises : `ATT..CESS` ne traverse rien sans `/`, mais la clause coute
--  un mot et ferme la question sans exiger du lecteur qu'il refasse le
--  raisonnement.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. LE PREDICAT, ECRIT UNE FOIS
--
--  `immutable` : ne lit ni table, ni session, ni heure. Exigence d'une
--  contrainte CHECK, et vraie ici — pas une declaration de complaisance.
--  Pas de `security definer` : elle ne lit rien, il n'y a aucune RLS a
--  contourner.
-- ---------------------------------------------------------------------

create or replace function public.reference_sans_traversee(p_valeur text)
returns boolean
language sql
immutable
as $function$
  select p_valeur is null
      or (p_valeur ~ '^[A-Za-z0-9._-]+$' and position('..' in p_valeur) = 0);
$function$;

comment on function public.reference_sans_traversee(text) is
  'Vrai si la valeur peut servir de NOM DE FICHIER sans jamais composer une traversee de chemin : charset [A-Za-z0-9._-] et pas de "..". NULL est accepte (les colonnes visees sont parfois nullables, et le gabarit de generation-document se rabat alors sur la colonne suivante). Porte les contraintes reference/numero de la dette #49 (jumeau EN ECRITURE, 10/08/2026) : generation-document compose `${table}/${reference ?? numero ?? id}.${ext}` puis televerse en service_role avec upsert:true. Mesure avant pose : 108 valeurs reelles, 0 refusee.';


-- ---------------------------------------------------------------------
--  2. ACL
--
--  Meme traitement qu'au §2 de 20260810100000, et pour la meme raison
--  MESUREE : le role qui INSERE a besoin d'EXECUTE sur une fonction
--  appelee depuis une contrainte CHECK (`ExecRelCheck` -> `ExecInitFunc`
--  -> `pg_proc_aclcheck`). Sans ces grants, toute ecriture dans les six
--  tables tomberait en 42501.
--
--  `authenticated` : `pv_bornage_owner_all` et les policies admin ecrivent
--  sous ce role. `service_role` : les edge functions de paiement et de
--  generation. `anon` n'est PAS accorde — aucune policy ne le sert, et
--  l'ajouter le ferait entrer dans les listes de reference du controle
--  horaire `securite-exposition-anon`.
-- ---------------------------------------------------------------------

revoke all on function public.reference_sans_traversee(text) from public, anon;
grant execute on function public.reference_sans_traversee(text) to authenticated, service_role;


-- ---------------------------------------------------------------------
--  3. GARDE-FOU AVANT ALTER — `raise exception`, jamais `warning`
--
--  `raise warning`/`raise notice` sont MUETS a travers
--  `scripts/supabase-sql.ps1`. Tout controle qui compte est une exception.
--  Le bloc dit COMBIEN et LESQUELLES, ce qu'un 23514 nu ne dirait pas.
-- ---------------------------------------------------------------------

do $$
declare
  n bigint;
  exemples text;
begin
  select count(*), string_agg(format('%s.%s = %L', t, c, v), E'\n  ')
    into n, exemples
  from (
    select 'attestations_cession' as t, 'reference' as c, reference as v from public.attestations_cession
    union all select 'attestations_attribution_lot', 'reference', reference from public.attestations_attribution_lot
    union all select 'certificats_vente', 'reference', reference from public.certificats_vente
    union all select 'attestations_coutumieres', 'reference', reference from public.attestations_coutumieres
    union all select 'attestations_coutumieres', 'numero', numero from public.attestations_coutumieres
    union all select 'paiements', 'reference', reference from public.paiements
    union all select 'pv_bornage', 'reference', reference from public.pv_bornage
  ) x
  where not public.reference_sans_traversee(x.v);

  if n > 0 then
    raise exception
      'Contraintes reference/numero NON POSEES : % valeur(s) hors motif. La mesure du 10/08/2026 en donnait 0 sur '
      '108 — les donnees ont donc change depuis. NE PAS elargir le motif pour faire passer : une reference qui porte '
      'un "/" ou un ".." compose un chemin de stockage arbitraire (generation-document:813). Valeurs en cause :%s%s',
      n, E'\n  ', exemples;
  end if;
end $$;


-- ---------------------------------------------------------------------
--  4. LES CONTRAINTES
--
--  Une par colonne visee, nommee explicitement pour que `pg_constraint`
--  se lise sans decodage. Toutes VALIDEES (pas de `not valid`) : sur 108
--  valeurs le scan est gratuit, et un `not valid` laisserait le passe
--  echapper tout en ayant l'air pose.
--
--  ⚠️ NON REJOUABLE : un second passage leve 42710. Conforme au reste du
--  depot ; la dette #27 (`supabase_migrations.schema_migrations`) reste la
--  vraie reponse.
--
--  ⚪ `attestations_coutumieres` recoit DEUX contraintes : `reference` ET
--  `numero`. C'est la seule table a porter les deux colonnes du gabarit,
--  et c'est exactement le cas ou l'on aurait ferme une colonne sur deux.
-- ---------------------------------------------------------------------

alter table public.attestations_cession
  add constraint attestations_cession_reference_sans_traversee
  check (public.reference_sans_traversee(reference));

alter table public.attestations_attribution_lot
  add constraint attestations_attribution_lot_reference_sans_traversee
  check (public.reference_sans_traversee(reference));

alter table public.certificats_vente
  add constraint certificats_vente_reference_sans_traversee
  check (public.reference_sans_traversee(reference));

alter table public.attestations_coutumieres
  add constraint attestations_coutumieres_reference_sans_traversee
  check (public.reference_sans_traversee(reference));

alter table public.attestations_coutumieres
  add constraint attestations_coutumieres_numero_sans_traversee
  check (public.reference_sans_traversee(numero));

alter table public.paiements
  add constraint paiements_reference_sans_traversee
  check (public.reference_sans_traversee(reference));

alter table public.pv_bornage
  add constraint pv_bornage_reference_sans_traversee
  check (public.reference_sans_traversee(reference));


-- ---------------------------------------------------------------------
--  5. CE QUE CE FICHIER NE FAIT PAS
--
--   · Il ne touche PAS aux policies. `pv_bornage_owner_all` continue de
--     ne contraindre que `mission_id`, et un geometre peut toujours creer
--     sa propre mission. Ce qui change : sa `reference` ne peut plus
--     composer un chemin. Resserrer la policy est un arbitrage distinct.
--   · Il ne retire PAS le grant INSERT d'`anon` sur `pv_bornage` et
--     `missions_geometre`, releve au passage le 10/08. `anon` ne passe
--     aujourd'hui aucune des policies (il n'a ni `mon_geometre_id()` ni
--     `est_admin()`), donc le grant est inerte — mais c'est un grant de
--     table qui n'a aucune raison d'exister, et il merite sa propre
--     migration plutot qu'un cavalier dans celle-ci.
--   · Il n'impose rien sur `id` : le type `uuid` le fait deja (§ bandeau).
-- ---------------------------------------------------------------------
