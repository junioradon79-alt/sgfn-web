-- =====================================================================
--  DETTE #49 — CONTROLE POST-DEPLOIEMENT, SUR LE CONTENU DE LA BASE
--
--  A executer en LECTURE SEULE (`scripts/supabase-sql.ps1 -ReadOnly`)
--  JUSTE APRES avoir applique les deux migrations :
--    20260810100000_documents_chemin_conforme_au_type.sql
--    20260810110000_reference_et_numero_sans_traversee.sql
--  et JUSTE APRES avoir redeploye les trois edge functions
--  (telecharger-document, convertir-plan-cad, generation-document).
--
--  ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────
--  Le vérificateur du 5e tour l'a demande explicitement : rejouer
--  `scripts/e2e-dette-49-chemin-signe.mjs` apres deploiement NE PROUVE
--  RIEN sur la base reelle — ce script lit des FICHIERS locaux (les
--  `index.ts` et les `.sql` du depot), jamais la base de production. Un
--  succes de `supabase-sql.ps1` (HTTP 201, contenu `[]`) ne prouve pas non
--  plus que l'objet demande a ete cree AVEC les bonnes proprietes — c'est
--  precisement le travers documente dans ce depot
--  (`verif_deploiement_contenu_pas_code_http.md`) : verifier un
--  deploiement sur le CONTENU, jamais sur un code HTTP.
--
--  Ce fichier ne CROIT donc rien : il relit `pg_constraint`,
--  `pg_get_functiondef`, `proacl`, et reevalue les DEUX predicats en SQL
--  contre le stock REEL de production, apres coup.
--
--  ⚠️ Ce fichier n'est PAS un `raise exception` unique : passe par
--  `scripts/supabase-sql.ps1 -ReadOnly` (SANS -ReadOnly une fois les
--  migrations reellement appliquees serait redondant — les fonctions ne
--  MODIFIENT rien, une lecture seule suffit toujours ici), il rend un
--  JSON qu'on LIT, ligne par ligne, motif par motif. Chaque ligne dont
--  `k3`/`k4` commence par `FAIL` est un defaut a traiter avant de
--  considerer le deploiement acquis.
-- =====================================================================

-- ── A. LES DEUX FONCTIONS EXISTENT, AVEC LES BONNES PROPRIETES ────────
select 'A_FONCTIONS' as bloc,
       p.proname as k1,
       case when p.provolatile = 'i' then 'OK immutable' else 'FAIL volatilite=' || p.provolatile::text end as k2,
       case when p.prosecdef then 'FAIL security_definer' else 'OK invoker' end as k3,
       'args=' || pg_get_function_identity_arguments(p.oid) as k4
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('documents_chemin_suit_le_type', 'reference_sans_traversee')

union all
-- Attendu : exactement 2 lignes ci-dessus. Zero = migration non appliquee.
select 'A_COMPTE', 'fonctions trouvees', count(*)::text,
       case when count(*) = 2 then 'OK' else 'FAIL attendu 2' end, ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('documents_chemin_suit_le_type', 'reference_sans_traversee')

union all
-- ── B. LES ACL — LE ROLE QUI ECRIT DOIT AVOIR LE DROIT, ANON NON ───────
--    C'est le point pour lequel un premier raisonnement a ete rendu FAUX
--    (tour 3) : verifie ici sur has_function_privilege, pas sur une
--    lecture supposee de la definition.
select 'B_ACL', p.proname,
       'authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text,
       'service_role=' || has_function_privilege('service_role', p.oid, 'EXECUTE')::text,
       'anon=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text ||
       case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
              and has_function_privilege('service_role', p.oid, 'EXECUTE')
              and not has_function_privilege('anon', p.oid, 'EXECUTE')
            then ' OK' else ' FAIL' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('documents_chemin_suit_le_type', 'reference_sans_traversee')

union all
-- ── C. LA CONTRAINTE `documents_chemin_conforme_au_type` ───────────────
select 'C_CONTRAINTE_DOCUMENTS', c.conname,
       case when c.convalidated then 'OK validee' else 'FAIL NOT VALID — le passe echappe' end,
       case when pg_get_constraintdef(c.oid) ~ 'url_fichier' and pg_get_constraintdef(c.oid) ~ 'apercu_url'
            then 'OK porte url_fichier ET apercu_url'
            else 'FAIL ne porte pas les deux colonnes' end,
       left(pg_get_constraintdef(c.oid), 200)
from pg_constraint c
where c.conrelid = 'public.documents'::regclass
  and c.conname = 'documents_chemin_conforme_au_type'

union all
select 'C_COMPTE', 'contrainte documents trouvee', count(*)::text,
       case when count(*) = 1 then 'OK' else 'FAIL attendu 1' end, ''
from pg_constraint c
where c.conrelid = 'public.documents'::regclass and c.conname = 'documents_chemin_conforme_au_type'

union all
-- ── D. LES SEPT CONTRAINTES reference/numero ────────────────────────────
select 'D_CONTRAINTES_REFERENCE', c.conrelid::regclass::text || '.' || c.conname,
       case when c.convalidated then 'OK validee' else 'FAIL NOT VALID' end,
       left(pg_get_constraintdef(c.oid), 120), ''
from pg_constraint c
where c.conname in (
  'attestations_cession_reference_sans_traversee',
  'attestations_attribution_lot_reference_sans_traversee',
  'certificats_vente_reference_sans_traversee',
  'attestations_coutumieres_reference_sans_traversee',
  'attestations_coutumieres_numero_sans_traversee',
  'paiements_reference_sans_traversee',
  'pv_bornage_reference_sans_traversee'
)

union all
select 'D_COMPTE', 'contraintes reference/numero trouvees', count(*)::text,
       case when count(*) = 7 then 'OK' else 'FAIL attendu 7' end, ''
from pg_constraint c
where c.conname in (
  'attestations_cession_reference_sans_traversee',
  'attestations_attribution_lot_reference_sans_traversee',
  'certificats_vente_reference_sans_traversee',
  'attestations_coutumieres_reference_sans_traversee',
  'attestations_coutumieres_numero_sans_traversee',
  'paiements_reference_sans_traversee',
  'pv_bornage_reference_sans_traversee'
)

union all
-- ── E. LE PREDICAT REEL, REEVALUE CONTRE LE STOCK EN PRODUCTION ────────
--    Pas « la migration s'est appliquee », mais « les lignes REELLES
--    d'AUJOURD'HUI passent le predicat REELLEMENT pose ». Une ligne
--    ecrite ENTRE la mesure du 10/08 et ce controle post-deploiement
--    (par une regeneration, par exemple) doit AUSSI passer.
select 'E_PREDICAT_DOCUMENTS_REEL', 'lignes documents', count(*)::text,
       'url_fichier refuse : ' || count(*) filter (
         where not public.documents_chemin_suit_le_type(d.type, d.url_fichier)
       )::text ||
       ' | apercu_url refuse : ' || count(*) filter (
         where d.apercu_url is not null
           and not public.documents_chemin_suit_le_type(d.type, d.apercu_url)
       )::text ||
       case when count(*) filter (
              where not public.documents_chemin_suit_le_type(d.type, d.url_fichier)
                 or (d.apercu_url is not null and not public.documents_chemin_suit_le_type(d.type, d.apercu_url))
            ) = 0
       then ' OK 0 refus' else ' FAIL — DES LIGNES EXISTANTES SERAIENT REFUSEES' end,
       ''
from public.documents d

union all
select 'E_PREDICAT_REFERENCES_REEL', t.tbl, count(*)::text,
       'hors motif : ' || count(*) filter (where not public.reference_sans_traversee(t.v))::text ||
       case when count(*) filter (where not public.reference_sans_traversee(t.v)) = 0
            then ' OK' else ' FAIL' end,
       ''
from (
  select 'attestations_cession' as tbl, reference as v from public.attestations_cession
  union all select 'attestations_attribution_lot', reference from public.attestations_attribution_lot
  union all select 'certificats_vente', reference from public.certificats_vente
  union all select 'attestations_coutumieres', reference from public.attestations_coutumieres
  union all select 'attestations_coutumieres', numero from public.attestations_coutumieres
  union all select 'paiements', reference from public.paiements
  union all select 'pv_bornage', reference from public.pv_bornage
) t
where t.v is not null
group by t.tbl

union all
-- ── F. LA CONTRE-EPREUVE : L'ATTAQUE DE L'ENONCE, REJOUEE EN LECTURE SEULE
--    Pas une insertion (interdite sous -ReadOnly de toute facon) : un
--    APPEL DIRECT des deux fonctions avec les valeurs de l'attaque
--    decrite, pour prouver que la garde REFUSE bien ce cas precis, sur la
--    base TELLE QU'ELLE EST APRES DEPLOIEMENT.
select 'F_CONTRE_EPREUVE', 'documents_chemin_suit_le_type(plan_lot, attestation forgee)',
       public.documents_chemin_suit_le_type(
         'plan_lot'::public.type_document,
         'attestations_cession/ATT-CESS-2026-00846.pdf'
       )::text,
       case when public.documents_chemin_suit_le_type(
                    'plan_lot'::public.type_document,
                    'attestations_cession/ATT-CESS-2026-00846.pdf'
                  ) = false
            then 'OK refuse' else 'FAIL — ACCEPTE, LA FAILLE EST OUVERTE' end,
       ''
union all
select 'F_CONTRE_EPREUVE', 'reference_sans_traversee(pv_bornage attaque)',
       public.reference_sans_traversee('../attestations_cession/ATT-CESS-2026-00846.pdf#')::text,
       case when public.reference_sans_traversee('../attestations_cession/ATT-CESS-2026-00846.pdf#') = false
            then 'OK refuse' else 'FAIL — ACCEPTE, LA FAILLE EST OUVERTE' end,
       ''
union all
-- Et la lecture LEGITIME continue de passer — le risque symetrique.
select 'F_CONTRE_EPREUVE', 'documents_chemin_suit_le_type(attestation reelle)',
       public.documents_chemin_suit_le_type(
         'attestation_cession'::public.type_document,
         'attestations_cession/ATT-CESS-2026-00846.pdf'
       )::text,
       case when public.documents_chemin_suit_le_type(
                    'attestation_cession'::public.type_document,
                    'attestations_cession/ATT-CESS-2026-00846.pdf'
                  ) = true
            then 'OK accepte' else 'FAIL — REFUSE UNE LECTURE LEGITIME' end,
       ''
union all
select 'F_CONTRE_EPREUVE', 'reference_sans_traversee(reference reelle)',
       public.reference_sans_traversee('ATT-CESS-2026-00846')::text,
       case when public.reference_sans_traversee('ATT-CESS-2026-00846') = true
            then 'OK accepte' else 'FAIL — REFUSE UNE REFERENCE LEGITIME' end,
       ''

union all
-- ── G. EVENT TRIGGER ET DEFAUT D'ACL — LES FONCTIONS N'ONT PAS ETE
--    RÉOUVERTES A anon PAR UN MECANISME QUE LES §B N'AURAIT PAS VU ────
--    `has_function_privilege` peut repondre correctement meme si l'ACL
--    porte un grant PUBLIC (anon herite de PUBLIC) — verification directe
--    de `proacl`, comme le rappelle la convention permanente du depot.
select 'G_PROACL_BRUT', p.proname,
       coalesce(array_to_string(p.proacl::text[], ' | '), '(proacl NULL = EXECUTE a PUBLIC — FAIL)'),
       case when p.proacl is null then 'FAIL — aucun ACL nomme, EXECUTE reste a PUBLIC'
            when array_to_string(p.proacl::text[], ',') ~ '=X/' and array_to_string(p.proacl::text[], ',') !~ 'anon=X'
            then 'OK aucun grant nomme a anon'
            when array_to_string(p.proacl::text[], ',') ~ 'anon=X' then 'FAIL — anon apparait dans proacl'
            else 'A VERIFIER A LA MAIN' end,
       ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('documents_chemin_suit_le_type', 'reference_sans_traversee')

union all
-- ── H. LE CONTROLE HORAIRE D'EXPOSITION anon DOIT TOUJOURS RENDRE 0 ────
--    Si une ligne de base manque pour ces deux fonctions neuves, le job
--    `securite-exposition-anon` (20260730040000/050000) hurlerait a la
--    prochaine heure. On le verifie a la source plutot que d'attendre.
select 'H_CONTROLE_EXPOSITION_ANON', 'fonctions dans les listes de reference anon', count(*)::text,
       case when count(*) = 0 then 'OK — aucune des deux, coherent (aucun grant a anon)'
            else 'A VERIFIER — presentes dans une liste de reference anon' end,
       ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('documents_chemin_suit_le_type', 'reference_sans_traversee')
  and has_function_privilege('anon', p.oid, 'EXECUTE')

order by 1, 2, 3;
