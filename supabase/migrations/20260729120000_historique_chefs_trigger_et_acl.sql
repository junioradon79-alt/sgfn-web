-- Trois corrections sur le chantier « chef en fonction à la date de l'acte »
-- (migrations 20260729100000 et 20260729110000), relevées par un vérificateur.
--
--   1. 🔴 L'historique n'était alimenté QUE par un backfill unique — régression.
--   2. 🔴 `revoke ... from public` ne retirait rien à `anon` — la fonction
--         restait appelable en clair par n'importe qui avec la clé publique.
--   3. 🟠 Un commentaire décrivait un comportement que la fonction n'a pas.

-- ── 1. 🔴 Tenir l'historique à jour, sinon le correctif se retourne contre lui ─
--
-- LA RÉGRESSION. `20260729100000` a peuplé `chefs_autorites_coutumieres` par un
-- backfill unique, et `chef_autorite_a_la_date()` refuse — volontairement —
-- tout repli sur `autorites_coutumieres.chef`. Or trois chemins écrivent ce
-- champ sans rien dire à l'historique :
--
--   · src/app/dashboard/familles/page.tsx:205 — CreerAutoriteModal, insert
--     d'une chefferie AVEC son chef ;
--   · src/app/dashboard/familles/page.tsx:326 — EditerAutoriteModal, update
--     du même champ (l'écran existe justement pour saisir l'arrêté après coup) ;
--   · public._appliquer_creation_structure() — la branche maker-checker, qui
--     crée une autorité depuis une soumission de saisie.
--
-- Une chefferie créée après le 29/07 n'a donc AUCUNE période. La page publique
-- /verifier et le PDF affichent « — » à la place du nom, alors qu'AVANT le
-- chantier le bon nom s'affichait. Le correctif a rendu faux ce qui marchait.
--
-- On ne rétablit surtout pas un repli sur `chef` : ce serait rouvrir le défaut
-- d'origine (un acte de 2022 signé par le chef de 2023). On branche l'historique
-- sur les écritures. Un TRIGGER plutôt que trois correctifs applicatifs : il
-- attrape les trois chemins d'un coup, y compris ceux qu'on n'a pas listés
-- (SQL manuel, futur écran, import).
--
-- ⚠️ Contrainte dure : ce trigger ne doit JAMAIS faire échouer la sauvegarde de
-- l'écran. Il cohabite avec `chefs_autorites_sans_chevauchement`, qui lève une
-- exception à la moindre période qui se recouvre — exception qui remonterait
-- telle quelle à l'admin en train d'enregistrer une chefferie. Chaque date
-- calculée plus bas est donc bornée pour que le chevauchement soit impossible
-- par construction, pas seulement improbable.

create or replace function public.autorites_synchroniser_historique_chefs()
returns trigger
language plpgsql
-- SECURITY DEFINER : l'historique doit suivre le parent quoi qu'il arrive. En
-- invoker, une écriture sur `autorites_coutumieres` par un rôle qui ne passe pas
-- `est_admin()` (aujourd'hui impossible — policy `autorites_admin_all` — mais
-- c'est une règle qui peut s'assouplir demain) ferait échouer l'insert dans
-- l'historique et donc la sauvegarde entière. L'élévation est nulle en pratique :
-- la fonction n'écrit que des valeurs tirées de NEW, sur la seule autorité qu'on
-- vient déjà d'avoir le droit de modifier.
security definer
set search_path to 'public'
as $function$
declare
  v_nouveau text;
  v_ancien  text;
  v_ouverte public.chefs_autorites_coutumieres%rowtype;
  v_fin_max date;
  v_bascule date;
begin
  -- `btrim` + `nullif` : « », «   » et NULL désignent tous les trois l'absence
  -- de chef. L'écran envoie déjà `chef.trim() || null`, mais l'import et le SQL
  -- manuel, non — et une comparaison qui prend « Nanan X » pour différent de
  -- « Nanan X » ouvrirait une période à chaque enregistrement.
  v_nouveau := nullif(btrim(new.chef), '');

  -- `old` n'existe pas sur INSERT : y toucher hors de cette branche lève
  -- « record "old" is not assigned yet ». plpgsql ne garantit pas le
  -- court-circuit d'un `and` dans un IF, d'où les gardes séparées partout.
  if tg_op = 'UPDATE' then
    v_ancien := nullif(btrim(old.chef), '');
  else
    v_ancien := null;
  end if;

  -- La période en cours. Au plus une : l'index unique partiel
  -- `chefs_autorites_un_seul_en_fonction` l'impose.
  select * into v_ouverte
  from chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id = new.id
    and c.fin is null;

  -- Dernière fin connue HORS période en cours. C'est le plancher absolu de
  -- toute période qu'on ouvrira : en deçà, `chefs_autorites_sans_chevauchement`
  -- refuse l'écriture et l'écran affiche l'exception.
  select max(c.fin) into v_fin_max
  from chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id = new.id
    and c.fin is not null
    and c.id is distinct from v_ouverte.id;

  -- ── Chef inchangé ──────────────────────────────────────────────────────────
  --
  -- Aucune période créée ici, jamais : l'écran d'édition se sauvegarde pour
  -- changer un contact ou joindre un scan, et chaque sauvegarde fabriquerait
  -- sinon un mandat fictif d'un jour.
  if v_nouveau is not distinct from v_ancien then
    if tg_op <> 'UPDATE' or v_nouveau is null or v_ouverte.id is null then
      return null;
    end if;
    -- L'historique parle de quelqu'un d'autre (désynchronisation antérieure) :
    -- on n'y touche pas, ce n'est pas à un changement de contact de trancher.
    if upper(btrim(v_ouverte.nom)) <> upper(v_nouveau) then
      return null;
    end if;
    if new.numero_arrete_nomination is not distinct from old.numero_arrete_nomination
       and new.date_arrete is not distinct from old.date_arrete
       and new.autorite_signataire is not distinct from old.autorite_signataire then
      return null;
    end if;
    -- L'arrêté se saisit APRÈS la création de la chefferie — c'est la raison
    -- d'être de EditerAutoriteModal (24/07). On reporte la pièce sur la période
    -- en cours, et on en profite pour resserrer `debut`, qui valait jusque-là
    -- NULL, c'est-à-dire « depuis toujours » aux yeux du résolveur.
    -- `debut` n'est repris que s'il ne heurte aucune période close : refuser une
    -- correction de métadonnée pour cause de chevauchement serait absurde.
    update chefs_autorites_coutumieres set
      numero_arrete_nomination = new.numero_arrete_nomination,
      date_arrete              = new.date_arrete,
      autorite_signataire      = new.autorite_signataire,
      debut = case
                when new.date_arrete is not null
                 and (v_fin_max is null or new.date_arrete > v_fin_max)
                then new.date_arrete
                else v_ouverte.debut
              end
    where id = v_ouverte.id;
    return null;
  end if;

  -- ── Chef effacé ────────────────────────────────────────────────────────────
  --
  -- Vider la case « Chef » efface un affichage, ça n'établit pas une fin de
  -- mandat. Poser une `fin` ici inventerait une date de départ que personne n'a
  -- fournie, et laisserait la chefferie sans chef en fonction — donc « — » sur
  -- tous ses actes récents. On ne touche à rien : l'historique reste le dernier
  -- fait constaté.
  if v_nouveau is null then
    return null;
  end if;

  -- ── Même personne, écriture corrigée ──────────────────────────────────────
  --
  -- « Nanan Kouassi » → « NANAN KOUASSI » n'est pas une succession. Sans ce
  -- test, une simple mise en forme clôturerait un mandat et en ouvrirait un
  -- second au même nom.
  if v_ouverte.id is not null and upper(btrim(v_ouverte.nom)) = upper(v_nouveau) then
    update chefs_autorites_coutumieres set
      nom                      = v_nouveau,
      numero_arrete_nomination = new.numero_arrete_nomination,
      date_arrete              = new.date_arrete,
      autorite_signataire      = new.autorite_signataire
    where id = v_ouverte.id;
    return null;
  end if;

  -- ── Première période connue ────────────────────────────────────────────────
  --
  -- Rien dans l'historique : c'est le cas de l'INSERT depuis l'écran, et on
  -- reprend exactement la sémantique du backfill du 29/07 — `debut` = date de
  -- l'arrêté si elle est connue, NULL sinon. NULL se lit « en fonction depuis
  -- une date que le registre ignore » ; écrire `current_date` à la place
  -- affirmerait une prise de fonction que personne n'a établie, alors qu'on
  -- enregistre souvent un chef en poste depuis des années.
  if v_ouverte.id is null and v_fin_max is null then
    insert into chefs_autorites_coutumieres
      (autorite_coutumiere_id, nom, numero_arrete_nomination, date_arrete, autorite_signataire, debut, fin)
    values (new.id, v_nouveau, new.numero_arrete_nomination, new.date_arrete, new.autorite_signataire,
            new.date_arrete, null);
    return null;
  end if;

  -- ── Succession ─────────────────────────────────────────────────────────────
  --
  -- Date de bascule, dans cet ordre :
  --
  --   1. `date_arrete` quand elle est fournie : c'est la pièce, elle prime sur
  --      la date du clic. Bornée à aujourd'hui par `least()`, car une date de
  --      nomination saisie dans le futur (2032 pour 2023, faute de frappe
  --      banale sur un champ date) ouvrirait la période du successeur dans neuf
  --      ans et laisserait un TROU d'ici là : aucun chef en fonction, donc « — »
  --      à l'écran. C'est-à-dire exactement le défaut qu'on est en train de
  --      corriger, réintroduit par une coquille de saisie.
  --   2. sinon `current_date` : on ne sait pas dater le changement autrement, et
  --      c'est la seule date dont on soit sûr qu'elle est postérieure au mandat
  --      précédent.
  --
  -- Puis deux planchers, imposés l'un et l'autre par le trigger
  -- anti-chevauchement — c'est ici que la cohabitation se joue :
  --   · strictement après la dernière période close ;
  --   · strictement après la prise de fonction du prédécesseur, sinon sa `fin`
  --     (= bascule − 1) tomberait avant son `debut`.
  v_bascule := coalesce(least(new.date_arrete, current_date), current_date);

  if v_fin_max is not null and v_bascule <= v_fin_max then
    v_bascule := v_fin_max + 1;
  end if;

  -- `date_arrete` antérieure à la prise de fonction du prédécesseur : elle est
  -- incohérente (on n'est pas nommé avant celui qu'on remplace), donc elle n'est
  -- pas « fournie et cohérente » — repli sur aujourd'hui plutôt que refus.
  if v_ouverte.id is not null and v_ouverte.debut is not null and v_bascule <= v_ouverte.debut then
    v_bascule := current_date;
    if v_fin_max is not null and v_bascule <= v_fin_max then
      v_bascule := v_fin_max + 1;
    end if;
  end if;

  if v_ouverte.id is not null and v_ouverte.debut is not null and v_bascule <= v_ouverte.debut then
    -- Même aujourd'hui ne permet pas de couper : le prédécesseur a pris ses
    -- fonctions aujourd'hui (ou à une date future). Il n'aurait pas tenu un
    -- seul jour — ce n'est donc pas une succession mais une CORRECTION de
    -- saisie : le nom mal tapé rattrapé dans la foulée de la création. On
    -- remplace le nom sur la période en cours plutôt que d'empiler deux mandats
    -- dont l'un n'a jamais existé — et surtout plutôt que de laisser le trigger
    -- anti-chevauchement refuser la sauvegarde de l'écran.
    update chefs_autorites_coutumieres set
      nom                      = v_nouveau,
      numero_arrete_nomination = new.numero_arrete_nomination,
      date_arrete              = new.date_arrete,
      autorite_signataire      = new.autorite_signataire
    where id = v_ouverte.id;
    return null;
  end if;

  -- L'ordre compte : on ferme AVANT d'ouvrir, sinon l'index unique partiel
  -- `chefs_autorites_un_seul_en_fonction` refuse la seconde période ouverte.
  if v_ouverte.id is not null then
    update chefs_autorites_coutumieres set fin = v_bascule - 1 where id = v_ouverte.id;
  end if;

  insert into chefs_autorites_coutumieres
    (autorite_coutumiere_id, nom, numero_arrete_nomination, date_arrete, autorite_signataire, debut, fin)
  values (new.id, v_nouveau, new.numero_arrete_nomination, new.date_arrete, new.autorite_signataire,
          v_bascule, null);

  return null;
end;
$function$;

comment on function public.autorites_synchroniser_historique_chefs() is
  'Maintient chefs_autorites_coutumieres au rythme de autorites_coutumieres.chef : INSERT ouvre la première période, UPDATE qui change le chef clôt le prédécesseur la veille et ouvre le successeur, chef inchangé ne crée jamais de période. Toutes les dates sont bornées pour ne jamais heurter chefs_autorites_sans_chevauchement : ce trigger ne doit pas pouvoir faire échouer la sauvegarde de l''écran.';

drop trigger if exists autorites_synchroniser_historique_chefs on public.autorites_coutumieres;
create trigger autorites_synchroniser_historique_chefs
  after insert or update on public.autorites_coutumieres
  for each row execute function public.autorites_synchroniser_historique_chefs();
-- AFTER et non BEFORE : la ligne parente doit exister avant que la clé étrangère
-- `autorite_coutumiere_id` puisse la référencer.

-- ── 1 bis. Rattrapage ────────────────────────────────────────────────────────
--
-- Les autorités créées entre l'application du 29/07 et celle-ci, s'il y en a.
-- Rejoué à chaque application sans effet de bord (`not exists`). `debut` reprend
-- la règle du backfill, avec le même plancher anti-chevauchement que le trigger.

insert into public.chefs_autorites_coutumieres
  (autorite_coutumiere_id, nom, numero_arrete_nomination, date_arrete, autorite_signataire, debut, fin)
select ac.id, btrim(ac.chef), ac.numero_arrete_nomination, ac.date_arrete, ac.autorite_signataire,
       case
         when m.fin_max is null then ac.date_arrete
         when ac.date_arrete is not null and ac.date_arrete > m.fin_max then ac.date_arrete
         else m.fin_max + 1
       end,
       null
from public.autorites_coutumieres ac
left join lateral (
  select max(c.fin) as fin_max
  from public.chefs_autorites_coutumieres c
  where c.autorite_coutumiere_id = ac.id and c.fin is not null
) m on true
where ac.chef is not null
  and btrim(ac.chef) <> ''
  and not exists (
    select 1 from public.chefs_autorites_coutumieres c
    where c.autorite_coutumiere_id = ac.id and c.fin is null
  );

-- ── 2. 🔴 `revoke ... from public` ne retirait rien à `anon` ─────────────────
--
-- `20260729100000` finissait par :
--   revoke all on function public.chef_autorite_a_la_date(uuid, date) from public;
-- Instruction INERTE sur Supabase. Le projet pose un `alter default privileges
-- ... grant execute on functions to anon, authenticated, service_role` : le
-- grant à `anon` est NOMMÉ, et `revoke ... from PUBLIC` ne retire que le
-- pseudo-rôle PUBLIC, jamais un grant nominatif.
--
-- Constaté en production le 29/07, ACL réelle avant correctif :
--   proacl = {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- et appel REST avec la seule clé anon publique :
--   POST /rest/v1/rpc/chef_autorite_a_la_date {"p_autorite":"a9c32…","p_date":"2022-02-10"}
--   → HTTP 200 [{"nom":"NANAN AFFA KOUACHY ALFRED", …}]
-- alors que la même requête sur la TABLE rend `[]` : la RLS écrite pour elle
-- faisait son travail, et la fonction SECURITY DEFINER la contournait.
--
-- La page publique /verifier n'est pas concernée : elle appelle
-- `verifier_document` (SECURITY DEFINER, exécutable par PUBLIC), qui appelle le
-- résolveur en tant que `postgres`. Le retrait ne ferme que l'appel DIRECT.

revoke all     on function public.chef_autorite_a_la_date(uuid, date) from public;
revoke execute on function public.chef_autorite_a_la_date(uuid, date) from anon;
grant  execute on function public.chef_autorite_a_la_date(uuid, date) to authenticated, service_role;

-- ── 3. 🟠 Le commentaire décrivait un comportement que la fonction n'a pas ────
--
-- `20260729100000` annonçait « Aucune correspondance → aucune ligne ». Vrai
-- seulement pour une période à `debut` renseigné. Une période dont `debut` est
-- NULL est ouverte vers le PASSÉ — elle couvre −infini — et rend donc un nom
-- pour n'importe quelle date antérieure à sa `fin` :
--   chef_autorite_a_la_date('a9c32…', '1900-01-01') → NANAN AFFA KOUACHY ALFRED
-- La sémantique est voulue (le plus ancien chef connu vaut mieux que rien pour
-- un acte antérieur au registre) ; c'est le commentaire qui mentait.
-- Corrigé ici et dans le fichier 20260729100000, aux deux endroits.

comment on function public.chef_autorite_a_la_date(uuid, date) is
  'Chef en fonction à p_date. p_date NULL → chef courant (période à fin NULL). Une période à debut NULL est ouverte vers le passé : toute date antérieure à sa fin rend ce chef — le plus ancien connu, jamais NULL. Aucune ligne seulement si l''autorité n''a aucune période, ou si p_date tombe dans un trou entre deux périodes. Jamais de repli sur autorites_coutumieres.chef : ce serait le défaut d''origine.';
