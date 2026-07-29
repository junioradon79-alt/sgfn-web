-- Le trigger `autorites_synchroniser_historique_chefs`, exercé de bout en bout.
--
--   powershell> .\scripts\supabase-sql.ps1 -SqlFile .\scripts\e2e-historique-chefs.sql
--
-- Attendu : 32 lignes, colonne `ok` à true partout.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE FICHIER EXISTE
--
-- Trois migrations (20260729100000, …120000, …140000) reposent sur ce trigger, et
-- AUCUN test ne l'exerçait. Les « 41/41 » annoncés au commit précédent ne sont
-- dans aucun fichier du dépôt : personne ne peut les rejouer, donc ils ne
-- prouvent rien. Ce fichier-ci est rejouable par n'importe qui.
--
-- L'enjeu justifie l'insistance : `chef_autorite_a_la_date()` refuse
-- délibérément tout repli sur `autorites_coutumieres.chef`. Une période mal
-- bornée ne lève AUCUNE erreur — elle remplace le nom du chef par un tiret sur
-- la page publique /verifier et dans le PDF. Il n'existe aucun autre signal.
--
-- POURQUOI EN SQL, ET DANS UNE TRANSACTION ANNULÉE
--
-- Le trigger est un objet de base : le passer par le navigateur ferait dépendre
-- le résultat de l'écran, de la session et de la RLS, et ne dirait rien des
-- chemins qui n'ont pas d'écran (SQL manuel, import, `_appliquer_creation_
-- structure`). On l'attaque là où il vit.
--
-- `begin … rollback` : ce script s'exécute EN PRODUCTION, sur la vraie base. Le
-- rollback est ce qui le rend sûr, et il l'est vraiment ici — vérifié, pas
-- supposé :
--   · `autorites_coutumieres` ne porte qu'UN trigger, celui-ci ;
--   · il n'appelle ni `sgfn_call_edge`, ni `net.http_post`, ni Resend : aucune
--     sortie hors base, donc rien qui survive à l'annulation ;
--   · il ne consomme AUCUNE séquence (`gen_random_uuid`, pas `nextval`) — c'est
--     la seule chose qu'un rollback ne rattrape pas, et le piège rencontré sur
--     `scripts/e2e-paiement-guichet.sql` (trou définitif dans `seq_quittance`).
-- Ce script peut donc être rejoué en boucle sans laisser de trace.
--
-- Le nettoyage est malgré tout écrit ET vérifié (contrôles 30 et 31 : les deux
-- tables sont recomptées après suppression explicite des autorités de contrôle),
-- pour que le fichier reste honnête si quelqu'un en retirait un jour le rollback.
--
-- ⚠️ Aucune écriture ne touche l'autorité a9c32cda-… (Ebimpe) ni l'APFC-EBIMPE-
-- 2022-001 : toutes les autorités de contrôle sont créées ici, préfixées
-- `e2e0ac01-`. Les contrôles 26 et 27 vérifient qu'Ebimpe est intacte.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DEUX PROTECTIONS CONTRE LE FAUX VERT, APPRISES ICI MÊME
--
-- 1. `ok boolean NOT NULL` + `coalesce(…, false)` sur CHAQUE contrôle. Au
--    premier passage, cinq contrôles rendaient `ok = null` et non `false` :
--    `(select nom from chef_autorite_a_la_date(…)) = 'CHEF A2'` vaut NULL quand
--    la fonction ne rend AUCUNE ligne — c'est-à-dire précisément dans le cas en
--    défaut. Un contrôle qui vire au NULL quand le défaut est présent est pire
--    qu'absent : il ne dit pas « faux », et tout comptage écrit `where not ok`
--    l'ignore silencieusement. C'est la même mécanique que la garde de
--    juridiction du 22/07, qui ne refusait rien parce qu'elle valait NULL.
--
-- 2. Contrôle 32 : le journal se compte lui-même. Plusieurs contrôles sont
--    écrits `insert into res select … from <table> where <id>` : si la ligne
--    attendue n'existe pas, l'insert ne pose AUCUNE ligne et le contrôle
--    DISPARAÎT du journal au lieu d'échouer. Trente-et-une lignes vertes au lieu
--    de trente-deux se lisent comme un succès pour qui ne recompte pas.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PREUVE PAR MUTATION — faite le 29/07, résultat ci-dessous
--
-- Un test qui passe ne prouve rien s'il passe aussi sans le correctif. Ce
-- fichier a donc été joué sur la production AVANT l'application de la migration
-- 20260729140000, c'est-à-dire contre l'ancien corps du trigger
-- (md5 `d75e75ab615979743c28e91393fe140a`). Douze contrôles sont tombés :
--
--   4  debut = 2032-07-29 au lieu d'aujourd'hui        (défaut 1, création)
--   5  aucun chef aujourd'hui pour A2                  (défaut 1, effet visible)
--   10 debut = 2032-07-29 au lieu d'aujourd'hui        (défaut 1, report)
--   11 aucun chef aujourd'hui pour A4                  (défaut 1, effet visible)
--   15 fin du prédécesseur restée au 2023-05-11        (défaut 2)
--   16 · 17 · 18  aucun chef les 12/05, 15/08 et 31/12/2023   (défaut 2, le trou)
--   20 debut poussé à 2022-01-01, le trou de A7 aggravé (défaut 2, versant b)
--   24 « 06 : trou du 2023-05-12 au 2023-12-31 »       (critère du chantier)
--   25 « 002, 004 » : deux chefferies sans chef aujourd'hui
--   28 anon=X sur les deux fonctions trigger           (hygiène ACL)
--
-- Pour refaire la mutation une fois la migration appliquée, réinjecter l'ancien
-- corps du trigger (celui de 20260729120000) à l'emplacement marqué plus bas :
--
--   $e2e = [IO.File]::ReadAllText('.\scripts\e2e-historique-chefs.sql')
--   $vieux = <corps `create or replace function …` de 20260729120000>
--   [IO.File]::WriteAllText('.\mutation.sql',
--     $e2e.Replace('-- <<< POINT D''INJECTION MUTATION >>>', $vieux))
--   .\scripts\supabase-sql.ps1 -SqlFile .\mutation.sql
--
-- (Le fichier mutant reste hors dépôt : il n'a d'intérêt qu'une fois.)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- <<< POINT D'INJECTION MUTATION >>>

-- `ok` NOT NULL : voir « DEUX PROTECTIONS CONTRE LE FAUX VERT » ci-dessus. Un
-- contrôle qui oublierait son `coalesce` fera échouer bruyamment l'insert au
-- lieu de se glisser au vert sous forme de NULL.
create temp table res(n int, controle text, ok boolean not null, detail text) on commit drop;

-- Comptes de départ, pour le contrôle de nettoyage en fin de fichier.
create temp table avant on commit drop as
select (select count(*) from public.autorites_coutumieres)        as nb_autorites,
       (select count(*) from public.chefs_autorites_coutumieres)  as nb_periodes;

-- Les deux dates hors bornes utilisées partout. `+ 6 ans` reproduit la coquille
-- réelle visée : 2032 tapé pour 2023 sur un `<input type="date">` sans `max`.
create temp table d on commit drop as
select current_date                              as aujourdhui,
       (current_date + interval '6 years')::date as futur,
       (current_date + interval '9 years')::date as futur_loin;

-- ═══════════════════════════════════════════════════════════════════════════
-- A1 — Création avec chef ET date d'arrêté normale
-- Le chemin CreerAutoriteModal (familles/page.tsx:205), cas nominal.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete, autorite_signataire)
values ('e2e0ac01-0000-4000-8000-000000000001', 'Controle e2e A1', 'chefferie', 'A1',
        'CHEF A1', 'N1/E2E', date '2015-03-04', 'Prefet e2e');

insert into res
select 1, 'A1 creation normale : une seule periode, ouverte, debut = date de l''arrete',
       coalesce(count(*) = 1 and max(debut) = date '2015-03-04' and count(*) filter (where fin is null) = 1, false),
       coalesce(string_agg(coalesce(debut::text,'(null)') || ' -> ' || coalesce(fin::text,'ouverte'), ' | '), '(aucune periode)')
from public.chefs_autorites_coutumieres where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000001';

insert into res
select 2, 'A1 : le resolveur rend le chef pour un acte de 2016',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000001', date '2016-01-01')) = 'CHEF A1', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000001', date '2016-01-01')), '(aucun chef — tiret a l''ecran)');

-- Le contre-contrôle : la période commence bien en 2015, elle ne couvre pas 2014.
-- Sans lui, le contrôle 2 passerait au vert avec un `debut` NULL, c'est-à-dire
-- une période ouverte vers le passé — exactement ce qu'on ne veut pas ici.
insert into res
select 3, 'A1 : un acte anterieur a l''arrete ne recoit AUCUN chef (pas de repli)',
       coalesce((select count(*) from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000001', date '2014-12-31')) = 0, false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000001', date '2014-12-31')), '(aucun chef — attendu)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A2 — 🔴 DÉFAUT 1 : création avec une date d'arrêté AU FUTUR
-- Le chemin le plus fréquent, et celui qui n'était protégé par rien.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
select 'e2e0ac01-0000-4000-8000-000000000002', 'Controle e2e A2', 'chefferie', 'A2',
       'CHEF A2', 'N2/E2E', d.futur from d;

insert into res
select 4, 'A2 DEFAUT 1 : date d''arrete au futur, `debut` borne a aujourd''hui',
       coalesce(c.debut = d.aujourdhui, false),
       'debut = ' || coalesce(c.debut::text, '(null)') || ' / arrete saisi = ' || d.futur::text
from public.chefs_autorites_coutumieres c, d
where c.autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000002';

-- Le contrôle qui compte vraiment : ce que le citoyen voit aujourd'hui.
insert into res
select 5, 'A2 DEFAUT 1 : un acte etabli AUJOURD''HUI affiche bien un chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000002', current_date)) = 'CHEF A2', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000002', current_date)),
                '(aucun chef — tiret sur /verifier et dans le PDF)');

-- La pièce n'est PAS réécrite : seule la déduction est bornée. C'est ce qui rend
-- la coquille visible à l'écran, donc corrigeable.
insert into res
select 6, 'A2 : `date_arrete` reste la valeur brute saisie (la piece n''est pas reecrite)',
       coalesce(c.date_arrete = d.futur, false),
       'date_arrete = ' || coalesce(c.date_arrete::text, '(null)')
from public.chefs_autorites_coutumieres c, d
where c.autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000002';

-- ═══════════════════════════════════════════════════════════════════════════
-- A3 — Création SANS date d'arrêté : `debut` doit rester NULL
--
-- LE CAS QUI DOIT ÊTRE ACCEPTÉ. `least(NULL, current_date)` vaut `current_date` :
-- une borne écrite naïvement transformerait « arrêté inconnu » en « prise de
-- fonction aujourd'hui » et masquerait tous les actes passés de la chefferie.
-- Sans ce contrôle, une sur-correction passerait inaperçue.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef)
values ('e2e0ac01-0000-4000-8000-000000000003', 'Controle e2e A3', 'chefferie', 'A3', 'CHEF A3');

insert into res
select 7, 'A3 sans arrete : `debut` reste NULL (aucune date inventee)',
       coalesce(count(*) = 1 and count(*) filter (where debut is null and fin is null) = 1, false),
       coalesce(string_agg(coalesce(debut::text,'(null)') || ' -> ' || coalesce(fin::text,'ouverte'), ' | '), '(aucune periode)')
from public.chefs_autorites_coutumieres where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000003';

insert into res
select 8, 'A3 : periode ouverte vers le passe, un acte de 1990 recoit ce chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000003', date '1990-01-01')) = 'CHEF A3', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000003', date '1990-01-01')), '(aucun)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A4 — Report d'arrêté après coup (EditerAutoriteModal, familles/page.tsx:326)
-- puis report d'un arrêté AU FUTUR sur la même autorité — 🔴 DÉFAUT 1.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef)
values ('e2e0ac01-0000-4000-8000-000000000004', 'Controle e2e A4', 'chefferie', 'A4', 'CHEF A4');

update public.autorites_coutumieres
   set numero_arrete_nomination = 'N4/E2E', date_arrete = date '2019-09-09', autorite_signataire = 'Prefet e2e'
 where id = 'e2e0ac01-0000-4000-8000-000000000004';

insert into res
select 9, 'A4 report d''arrete : `debut` passe de NULL a la date de l''arrete, sans nouvelle periode',
       coalesce(count(*) = 1 and max(debut) = date '2019-09-09' and max(numero_arrete_nomination) = 'N4/E2E', false),
       count(*)::text || ' periode(s), debut = ' || coalesce(max(debut)::text,'(null)')
from public.chefs_autorites_coutumieres where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000004';

update public.autorites_coutumieres
   set date_arrete = (select futur from d)
 where id = 'e2e0ac01-0000-4000-8000-000000000004';

insert into res
select 10, 'A4 DEFAUT 1 : report d''un arrete AU FUTUR, `debut` borne a aujourd''hui',
       coalesce(c.debut = d.aujourdhui and c.date_arrete = d.futur, false),
       'debut = ' || coalesce(c.debut::text,'(null)') || ' / date_arrete = ' || coalesce(c.date_arrete::text,'(null)')
from public.chefs_autorites_coutumieres c, d
where c.autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000004';

insert into res
select 11, 'A4 DEFAUT 1 : un acte etabli AUJOURD''HUI affiche bien un chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000004', current_date)) = 'CHEF A4', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000004', current_date)),
                '(aucun chef — tiret sur /verifier et dans le PDF)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A5 — Succession : le prédécesseur est clos la veille, sans trou ni recouvrement
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000005', 'Controle e2e A5', 'chefferie', 'A5',
        'CHEF A5 UN', 'N5A/E2E', date '2015-01-01');

update public.autorites_coutumieres
   set chef = 'CHEF A5 DEUX', numero_arrete_nomination = 'N5B/E2E', date_arrete = date '2020-02-02'
 where id = 'e2e0ac01-0000-4000-8000-000000000005';

insert into res
select 12, 'A5 succession : deux periodes contigues, [2015-01-01…2020-02-01] puis [2020-02-02…∞[',
       coalesce(count(*) = 2
       and count(*) filter (where nom = 'CHEF A5 UN'   and debut = date '2015-01-01' and fin = date '2020-02-01') = 1
       and count(*) filter (where nom = 'CHEF A5 DEUX' and debut = date '2020-02-02' and fin is null) = 1, false),
       coalesce(string_agg(nom || ' [' || coalesce(debut::text,'-inf') || ' … ' || coalesce(fin::text,'inf') || ']', ' | ' order by debut), '(aucune)')
from public.chefs_autorites_coutumieres where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000005';

insert into res
select 13, 'A5 : un acte de 2018 est signe du PREDECESSEUR, pas du chef courant',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000005', date '2018-06-01')) = 'CHEF A5 UN', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000005', date '2018-06-01')), '(aucun)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A6 — 🔴 DÉFAUT 2 : corriger une date d'arrêté vers l'avant
--
-- La reproduction exacte du scénario Ebimpe, sur une autorité jetable : la `fin`
-- du prédécesseur a été DÉDUITE de l'arrêté du successeur (§4.b de
-- 20260729100000 : « C'est une déduction, pas une pièce »). Corriger cet arrêté
-- de 2023-05-12 vers 2024-01-01 déplaçait `debut` seul et laissait 234 jours
-- sans aucun chef. `chefs_autorites_sans_chevauchement` ne voit pas les trous.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000006', 'Controle e2e A6', 'chefferie', 'A6',
        'CHEF A6 SUCCESSEUR', 'N6/E2E', date '2023-05-12');

-- Le prédécesseur, posé à la main comme l'a fait §4.b : `fin` = veille de la
-- prise de fonction du successeur. C'est cette contiguïté qui signe la déduction.
insert into public.chefs_autorites_coutumieres (autorite_coutumiere_id, nom, debut, fin)
values ('e2e0ac01-0000-4000-8000-000000000006', 'CHEF A6 PREDECESSEUR', date '2007-04-25', date '2023-05-11');

update public.autorites_coutumieres
   set date_arrete = date '2024-01-01'
 where id = 'e2e0ac01-0000-4000-8000-000000000006';

insert into res
select 14, 'A6 DEFAUT 2 : `debut` du successeur suit la correction (2024-01-01)',
       coalesce((select debut from public.chefs_autorites_coutumieres
         where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000006' and fin is null) = date '2024-01-01', false),
       coalesce((select debut::text from public.chefs_autorites_coutumieres
         where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000006' and fin is null), '(null)');

insert into res
select 15, 'A6 DEFAUT 2 : la `fin` DEDUITE du predecesseur suit le mouvement (2023-12-31)',
       coalesce((select fin from public.chefs_autorites_coutumieres
         where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000006' and nom = 'CHEF A6 PREDECESSEUR') = date '2023-12-31', false),
       coalesce((select fin::text from public.chefs_autorites_coutumieres
         where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000006' and nom = 'CHEF A6 PREDECESSEUR'), '(null)');

-- Les trois dates de la fenêtre autrefois vide. Ce sont elles qui produisaient un
-- tiret sur la page publique, et elles sont le vrai objet du défaut 2.
insert into res
select 16, 'A6 DEFAUT 2 : le 2023-05-12 (1er jour du trou) a de nouveau un chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-05-12')) = 'CHEF A6 PREDECESSEUR', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-05-12')),
                '(aucun chef — le trou est ouvert)');

insert into res
select 17, 'A6 DEFAUT 2 : le 2023-08-15 (milieu du trou) a un chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-08-15')) = 'CHEF A6 PREDECESSEUR', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-08-15')),
                '(aucun chef — le trou est ouvert)');

insert into res
select 18, 'A6 DEFAUT 2 : le 2023-12-31 (dernier jour du trou) a un chef',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-12-31')) = 'CHEF A6 PREDECESSEUR', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2023-12-31')),
                '(aucun chef — le trou est ouvert)');

-- Et le successeur commence bien le lendemain : sans ce contrôle, une correction
-- qui aurait tout absorbé au profit du prédécesseur passerait au vert.
insert into res
select 19, 'A6 : le 2024-01-01 est bien au SUCCESSEUR (la correction n''a pas tout absorbe)',
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2024-01-01')) = 'CHEF A6 SUCCESSEUR', false),
       coalesce((select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000006', date '2024-01-01')), '(aucun)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A7 — DÉFAUT 2, l'autre versant : une `fin` qui n'est PAS une déduction
--
-- Le prédécesseur s'arrête en 2015 et le successeur ne prend ses fonctions qu'en
-- 2020 : l'écart préexiste, donc cette `fin` a été établie indépendamment (une
-- vraie vacance, une destitution datée…). On ne l'écrase pas — et on n'aggrave
-- pas le trou : `debut` ne bouge pas vers l'avant.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000007', 'Controle e2e A7', 'chefferie', 'A7',
        'CHEF A7', 'N7/E2E', date '2020-01-01');

insert into public.chefs_autorites_coutumieres (autorite_coutumiere_id, nom, debut, fin)
values ('e2e0ac01-0000-4000-8000-000000000007', 'CHEF A7 ANCIEN', date '2010-01-01', date '2015-12-31');

update public.autorites_coutumieres
   set date_arrete = date '2022-01-01'
 where id = 'e2e0ac01-0000-4000-8000-000000000007';

insert into res
select 20, 'A7 : `fin` non deduite -> le predecesseur n''est PAS reecrit et le trou n''est pas aggrave',
       coalesce(
         (select fin from public.chefs_autorites_coutumieres
           where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000007' and nom = 'CHEF A7 ANCIEN') = date '2015-12-31'
         and (select debut from public.chefs_autorites_coutumieres
               where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000007' and fin is null) = date '2020-01-01'
         and (select date_arrete from public.chefs_autorites_coutumieres
               where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000007' and fin is null) = date '2022-01-01', false),
       'fin predecesseur = ' || coalesce((select fin::text from public.chefs_autorites_coutumieres
                                           where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000007' and nom = 'CHEF A7 ANCIEN'),'(null)')
       || ' / debut successeur = ' || coalesce((select debut::text from public.chefs_autorites_coutumieres
                                           where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000007' and fin is null),'(null)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A8 — Le mouvement en ARRIÈRE reste accepté
--
-- LE SECOND CAS QUI DOIT ÊTRE ACCEPTÉ. Une garde qui refuserait TOUT report
-- ferait passer A7 au vert pour une mauvaise raison. Ici la correction RECULE
-- `debut` (2020-06-01 → 2015-01-01) : elle comble l'écart au lieu de le creuser,
-- elle doit passer.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000008', 'Controle e2e A8', 'chefferie', 'A8',
        'CHEF A8', 'N8/E2E', date '2020-06-01');

insert into public.chefs_autorites_coutumieres (autorite_coutumiere_id, nom, debut, fin)
values ('e2e0ac01-0000-4000-8000-000000000008', 'CHEF A8 ANCIEN', date '2000-01-01', date '2010-12-31');

update public.autorites_coutumieres
   set date_arrete = date '2015-01-01'
 where id = 'e2e0ac01-0000-4000-8000-000000000008';

insert into res
select 21, 'A8 : une correction qui RECULE `debut` est appliquee (la garde ne refuse pas tout)',
       coalesce(
         (select debut from public.chefs_autorites_coutumieres
           where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000008' and fin is null) = date '2015-01-01'
         and (select nom from public.chef_autorite_a_la_date('e2e0ac01-0000-4000-8000-000000000008', date '2016-01-01')) = 'CHEF A8', false),
       'debut = ' || coalesce((select debut::text from public.chefs_autorites_coutumieres
                                where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000008' and fin is null),'(null)');

-- ═══════════════════════════════════════════════════════════════════════════
-- A9 — Sauvegarde sans changement de chef : rien ne doit être créé
--
-- L'écran d'édition se sauvegarde pour changer un contact ou joindre un scan.
-- Chaque sauvegarde fabriquerait sinon un mandat fictif d'un jour.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, numero_arrete_nomination, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000009', 'Controle e2e A9', 'chefferie', 'A9',
        'CHEF A9', 'N9/E2E', date '2012-12-12');

update public.autorites_coutumieres set contact = '+225 00 00 00 00'
 where id = 'e2e0ac01-0000-4000-8000-000000000009';
update public.autorites_coutumieres set village = 'A9 bis'
 where id = 'e2e0ac01-0000-4000-8000-000000000009';
-- Et la re-sauvegarde à l'identique du même chef (l'écran renvoie tous les champs).
update public.autorites_coutumieres set chef = 'CHEF A9'
 where id = 'e2e0ac01-0000-4000-8000-000000000009';

insert into res
select 22, 'A9 : trois sauvegardes sans changement de chef ne creent AUCUNE periode',
       coalesce(count(*) = 1 and max(debut) = date '2012-12-12' and count(*) filter (where fin is not null) = 0, false),
       count(*)::text || ' periode(s) : ' ||
       coalesce(string_agg(nom || ' [' || coalesce(debut::text,'-inf') || ' … ' || coalesce(fin::text,'inf') || ']', ' | '), '')
from public.chefs_autorites_coutumieres where autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000009';

-- ═══════════════════════════════════════════════════════════════════════════
-- A10 — Succession avec une date d'arrêté AU FUTUR
-- La branche qui était déjà bornée : contrôle de non-régression, la borne est
-- désormais partagée par les trois chemins.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.autorites_coutumieres (id, nom, type, village, chef, date_arrete)
values ('e2e0ac01-0000-4000-8000-000000000010', 'Controle e2e A10', 'chefferie', 'A10',
        'CHEF A10 UN', date '2015-01-01');

update public.autorites_coutumieres
   set chef = 'CHEF A10 DEUX', date_arrete = (select futur_loin from d)
 where id = 'e2e0ac01-0000-4000-8000-000000000010';

insert into res
select 23, 'A10 succession au futur : bascule ramenee a aujourd''hui, predecesseur clos hier',
       coalesce(count(*) filter (where nom = 'CHEF A10 DEUX' and debut = d.aujourdhui and fin is null) = 1
       and count(*) filter (where nom = 'CHEF A10 UN' and fin = d.aujourdhui - 1) = 1, false),
       coalesce(string_agg(nom || ' [' || coalesce(debut::text,'-inf') || ' … ' || coalesce(fin::text,'inf') || ']', ' | ' order by debut), '(aucune)')
from public.chefs_autorites_coutumieres c, d
where c.autorite_coutumiere_id = 'e2e0ac01-0000-4000-8000-000000000010'
group by d.aujourdhui;

-- ═══════════════════════════════════════════════════════════════════════════
-- Contrôle transversal : AUCUN TROU entre la première période et aujourd'hui
--
-- Le critère du chantier, mesuré d'un coup sur toutes les autorités de contrôle.
-- A7 et A8 sont exclues : leur écart est délibéré (une vacance établie, pas un
-- trou creusé par le trigger) et les contrôles 20 et 21 le vérifient nommément.
-- ═══════════════════════════════════════════════════════════════════════════

insert into res
select 24, 'Aucun trou entre deux periodes consecutives (A1 a A6, A9, A10)',
       coalesce(count(*) = 0, false),
       coalesce(string_agg(t.autorite || ' : trou du ' || (t.fin + 1)::text || ' au ' || (t.suivant - 1)::text, ' | '), 'aucun trou')
from (
  select right(c.autorite_coutumiere_id::text, 2) as autorite, c.fin,
         lead(c.debut) over (partition by c.autorite_coutumiere_id order by c.debut nulls first) as suivant
  from public.chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id::text like 'e2e0ac01-%'
    and c.autorite_coutumiere_id not in ('e2e0ac01-0000-4000-8000-000000000007',
                                         'e2e0ac01-0000-4000-8000-000000000008')
) t
where t.fin is not null and t.suivant is not null and t.suivant > t.fin + 1;

-- Et le pendant : chaque autorité de contrôle désigne un chef AUJOURD'HUI.
-- C'est la formulation métier du défaut 1 — un tiret sur /verifier.
insert into res
select 25, 'Chacune des 10 autorites de controle designe un chef aujourd''hui',
       coalesce(count(*) filter (where nom_resolu is null) = 0, false),
       coalesce(string_agg(autorite, ', ') filter (where nom_resolu is null), 'toutes resolues')
from (
  select right(a.id::text, 3) as autorite,
         (select nom from public.chef_autorite_a_la_date(a.id, current_date)) as nom_resolu
  from public.autorites_coutumieres a
  where a.id::text like 'e2e0ac01-%'
) r;

-- ═══════════════════════════════════════════════════════════════════════════
-- Non-régression : Ebimpe et l'APFC, intouchées
-- ═══════════════════════════════════════════════════════════════════════════

insert into res
select 26, 'Ebimpe intacte : NANAN [2007-04-25 → 2023-05-11], HOBI [2023-05-12 → ∞[',
       coalesce(count(*) = 2
       and count(*) filter (where nom = 'NANAN AFFA KOUACHY ALFRED' and debut = date '2007-04-25' and fin = date '2023-05-11') = 1
       and count(*) filter (where nom = 'HOBI MONDON ATSIN PACOME' and debut = date '2023-05-12' and fin is null) = 1, false),
       coalesce(string_agg(nom || ' [' || coalesce(debut::text,'-inf') || ' … ' || coalesce(fin::text,'inf') || ']', ' | ' order by debut), '(aucune)')
from public.chefs_autorites_coutumieres
where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb';

-- Un SEUL appel à `verifier_document` : c'est la fonction que la page publique
-- appelle, et l'appeler deux fois ferait deux passages dans son compteur.
insert into res
select 27, 'verifier_document(APFC-EBIMPE-2022-001) : NANAN AFFA KOUACHY ALFRED / 2022-02-10',
       coalesce((v->>'autorite_chef') = 'NANAN AFFA KOUACHY ALFRED' and (v->>'date_delivrance') = '2022-02-10', false),
       coalesce(v->>'autorite_chef','(null)') || ' / ' || coalesce(v->>'date_delivrance','(null)')
from public.verifier_document('APFC-EBIMPE-2022-001') v;

-- ═══════════════════════════════════════════════════════════════════════════
-- Hygiène ACL — `anon` ne doit plus avoir EXECUTE sur les fonctions du chantier
-- ═══════════════════════════════════════════════════════════════════════════

insert into res
select 28, 'ACL : anon n''a EXECUTE sur aucune des 3 fonctions du chantier',
       coalesce(
         not has_function_privilege('anon', 'public.autorites_synchroniser_historique_chefs()', 'execute')
         and not has_function_privilege('anon', 'public.chefs_autorites_sans_chevauchement()', 'execute')
         and not has_function_privilege('anon', 'public.chef_autorite_a_la_date(uuid,date)', 'execute'), false),
       'trigger_sync=' || has_function_privilege('anon', 'public.autorites_synchroniser_historique_chefs()', 'execute')::text
       || ' / anti_chevauchement=' || has_function_privilege('anon', 'public.chefs_autorites_sans_chevauchement()', 'execute')::text
       || ' / resolveur=' || has_function_privilege('anon', 'public.chef_autorite_a_la_date(uuid,date)', 'execute')::text;

-- Le contre-contrôle : `authenticated` doit AVOIR gardé le droit sur le
-- résolveur, sinon le contrôle 28 passerait au vert pour avoir tout fermé.
insert into res
select 29, 'ACL contre-controle : authenticated garde EXECUTE sur le resolveur',
       coalesce(has_function_privilege('authenticated', 'public.chef_autorite_a_la_date(uuid,date)', 'execute'), false),
       has_function_privilege('authenticated', 'public.chef_autorite_a_la_date(uuid,date)', 'execute')::text;

-- ═══════════════════════════════════════════════════════════════════════════
-- Nettoyage, et sa vérification
--
-- Le `rollback` final suffirait. On supprime quand même explicitement et on
-- RECOMPTE les deux tables : si quelqu'un retirait un jour le rollback, le
-- fichier resterait sûr, et le contrôle le dirait.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.autorites_coutumieres where id::text like 'e2e0ac01-%';

insert into res
select 30, 'Nettoyage : `autorites_coutumieres` retrouve son compte de depart',
       coalesce((select count(*) from public.autorites_coutumieres) = a.nb_autorites, false),
       a.nb_autorites::text || ' avant / ' || (select count(*) from public.autorites_coutumieres)::text || ' apres'
from avant a;

insert into res
select 31, 'Nettoyage : `chefs_autorites_coutumieres` retrouve son compte de depart (cascade)',
       coalesce((select count(*) from public.chefs_autorites_coutumieres) = a.nb_periodes, false),
       a.nb_periodes::text || ' avant / ' || (select count(*) from public.chefs_autorites_coutumieres)::text || ' apres'
from avant a;

-- Le journal se compte lui-même : plusieurs contrôles ci-dessus sont écrits
-- `insert … select … from <table> where <id>`, et n'inscrivent RIEN si la ligne
-- attendue manque. Sans ce dernier contrôle, un contrôle disparu se lirait
-- comme un contrôle réussi.
insert into res
select 32, 'Le journal est complet : les 31 controles precedents sont inscrits',
       coalesce(count(*) = 31, false),
       count(*)::text || ' controle(s) inscrits, manquant(s) : ' ||
       coalesce((select string_agg(g::text, ', ') from generate_series(1,31) g where g not in (select n from res)), 'aucun')
from res;

select n, controle, ok, detail from res order by n;

rollback;
