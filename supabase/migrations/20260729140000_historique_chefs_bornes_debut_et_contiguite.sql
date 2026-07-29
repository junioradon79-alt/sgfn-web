-- Deux défauts du trigger `autorites_synchroniser_historique_chefs`
-- (migration 20260729120000, appliquée en production le 29/07), relevés par un
-- vérificateur — plus une hygiène d'ACL laissée en suspens.
--
--   1. 🔴 La borne `least(…, current_date)` ne protégeait QUE la succession,
--         c'est-à-dire le plus RARE des trois chemins qui écrivent `debut`.
--   2. 🔴 Corriger une date d'arrêté vers l'avant creusait une fenêtre sans
--         aucun chef, invisible pour la garde anti-chevauchement.
--   3. 🟠 Les deux fonctions trigger du chantier gardaient `anon=X`.
--
-- Rappel de l'enjeu, parce qu'il commande tous les arbitrages ci-dessous :
-- `chef_autorite_a_la_date()` refuse DÉLIBÉRÉMENT tout repli sur
-- `autorites_coutumieres.chef` (§5 de 20260729100000 — c'est le défaut d'origine
-- qu'on ne veut pas rouvrir). Conséquence : une période mal bornée ne produit
-- aucune erreur, nulle part. Elle produit un tiret à la place du nom du chef sur
-- la page publique /verifier et dans le PDF. Le seul signal est visuel, sur un
-- écran que personne ne regarde tous les jours.

-- ── 1. 🔴 La borne manquait sur les deux chemins les plus fréquents ──────────
--
-- `20260729120000` bornait la date de bascule à aujourd'hui — mais seulement
-- dans la branche SUCCESSION, et son commentaire (« une date de nomination
-- saisie dans le futur … laisserait un TROU d'ici là ») décrit un risque qui
-- vaut mot pour mot pour les deux autres branches. Elles écrivaient `debut`
-- brut :
--
--   · Première période connue  : `values (…, new.date_arrete /* debut */, null)`
--   · Report d'arrêté en cours : `debut = case when … then new.date_arrete …`
--
-- Or ce sont exactement les deux chemins de l'écran admin :
--   src/app/dashboard/familles/page.tsx:205 — CreerAutoriteModal : on crée la
--     chefferie avec son chef ET la date de l'arrêté d'un coup → 1re période.
--   src/app/dashboard/familles/page.tsx:326 — EditerAutoriteModal : l'arrêté se
--     saisit après coup, c'est la raison d'être de l'écran → report.
-- La succession, elle, suppose un changement de chef : quelques fois par
-- décennie et par chefferie.
--
-- Rien en amont ne rattrape une coquille de saisie, vérifié en production le
-- 29/07 :
--   · `autorites_coutumieres` n'a AUCUNE contrainte CHECK — sa seule contrainte
--     est sa clé primaire ;
--   · le champ est un `<input type="date">` SANS attribut `max`
--     (familles/page.tsx:251 et :376) ;
--   · et le résolveur ne rend rien sous `debut` — mesuré, pas supposé :
--     `chef_autorite_a_la_date('a9c32cda-…', '2007-04-24')` → 0 ligne.
--
-- Un admin qui tape 2032 au lieu de 2023 enregistre donc sans la moindre erreur
-- une chefferie dont TOUS les actes s'afficheront sans signataire pendant six
-- ans.
--
-- Le correctif tient en une variable calculée une fois pour les trois branches,
-- `v_arrete_borne`, au lieu d'une expression recopiée à trois endroits — c'est
-- la recopie qui a produit le défaut.
--
-- ⚠️ `least(NULL, current_date)` vaut `current_date` : `least` IGNORE les NULL,
-- il ne les propage pas. Écrire `least(new.date_arrete, current_date)` tel quel
-- transformerait « arrêté inconnu » (date_arrete NULL) en « prise de fonction
-- aujourd'hui », c'est-à-dire précisément la date inventée que §1 de
-- 20260729100000 refuse de fabriquer, et qui masquerait tous les actes passés de
-- la chefferie. D'où le `case … when null then null` explicite.
--
-- ⚠️ Seul `debut` est borné. `date_arrete` est recopié BRUT dans l'historique :
-- c'est la pièce telle que l'admin l'a saisie, y compris fausse. La borne
-- protège le fait DÉDUIT ; elle n'a pas à réécrire la déclaration. C'est aussi
-- ce qui rend la coquille rattrapable : rouvrir l'écran montre encore 2032, et
-- la corriger repasse par la branche « report » qui remet `debut` en place.

-- ── 2. 🔴 Corriger une date d'arrêté vers l'avant creusait un trou ───────────
--
-- Branche « chef inchangé, métadonnée modifiée ». `debut` était repris dès que
-- `new.date_arrete > v_fin_max`. Cette condition vérifie l'absence de
-- CHEVAUCHEMENT ; elle ne dit rien de la CONTIGUÏTÉ.
--
-- Sur Ebimpe, la `fin` du prédécesseur (2023-05-11) n'est pas une pièce : elle a
-- été DÉDUITE de l'arrêté du successeur, et le §4.b de 20260729100000 le dit
-- explicitement — « C'est une déduction, pas une pièce ». Si un admin corrige la
-- date de l'arrêté 38/PA/SG/D1 de 2023-05-12 vers 2024-01-01, l'ancien trigger
-- posait `debut = 2024-01-01` et ne touchait pas au prédécesseur :
--
--   NANAN  [2007-04-25 … 2023-05-11]
--   ← 2023-05-12 … 2023-12-31 : AUCUN CHEF, 234 jours →
--   HOBI   [2024-01-01 … ∞[
--
-- `chefs_autorites_sans_chevauchement` ne voit rien : il ne détecte que les
-- recouvrements, jamais les manques. Tout acte de cette fenêtre s'afficherait
-- sans signataire.
--
-- LE PARTI PRIS. On décale la `fin` du prédécesseur pour rester contigu — mais
-- pas inconditionnellement, sinon on écraserait une `fin` qui serait, elle, une
-- vraie pièce (un acte de destitution daté, par exemple).
--
-- Le critère de discernement est dans la donnée elle-même : une `fin` DÉDUITE du
-- `debut` du successeur vaut, par construction, `debut − 1`. C'est la formule
-- qu'écrit la branche succession de ce trigger (`fin = v_bascule - 1`) et c'est
-- celle qu'a appliquée à la main le §4.b de 20260729100000.
--
--   · prédécesseur contigu (`fin = debut − 1`) → on recalcule sa `fin` depuis le
--     `debut` corrigé.
--   · prédécesseur NON contigu → un écart existe déjà, donc sa `fin` a été posée
--     indépendamment. On n'y touche pas, et on ne creuse pas davantage : `debut`
--     ne bouge que s'il RECULE (ce qui comble l'écart) ; un mouvement vers
--     l'avant est refusé — la métadonnée (numéro, date, signataire) est
--     enregistrée, `debut` reste où il est.
--
-- 🔴 CE CRITÈRE N'EST PAS SANS PERTE — ne pas lire la branche contiguë comme un
-- simple recalcul. La contiguïté n'est PAS la signature exclusive d'une
-- déduction : c'est aussi celle d'une succession parfaitement normale, où un
-- chef part et son successeur prend fonction le lendemain — le cas majoritaire.
-- Si cette `fin`-là était une PIÈCE (un acte de destitution daté), la corriger
-- vers l'avant l'écrase sans trace, et les actes de l'intervalle s'afficheront
-- alors au nom du prédécesseur : un NOM FAUX, pas un tiret — ce qui contredit le
-- principe directeur du chantier.
--
-- On l'assume faute de mieux : le schéma ne permet PAS de distinguer une `fin`
-- déduite d'une `fin` établie (aucune colonne de provenance, aucun `modifie_le`),
-- et l'alternative — laisser le trou — rend un tiret. Aucune ligne de production
-- n'est concernée aujourd'hui : la `fin` de NANAN AFFA KOUACHY ALFRED est bien
-- une déduction, explicitement signalée comme telle au §4.b.
--
-- ⭐ Le vrai correctif, le jour où le cas devient réel, est une COLONNE DE
-- PROVENANCE sur `fin` (déduite / établie), pas une retouche de ce trigger.
--
-- Refuser tout le mouvement (lever une exception) a été écarté : ce trigger a
-- pour contrainte dure de ne JAMAIS faire échouer la sauvegarde de l'écran
-- (§ « Contrainte dure » de 20260729120000). Une exception ici remonterait
-- telle quelle à l'admin en train de corriger une faute de frappe.
--
-- ⚠️ CE QU'ON NE FORCE PAS. Une vacance réelle reste possible et légitime : un
-- chef part en 2023, son successeur est nommé en 2026. Là, `v_fin_max` n'a pas
-- été déduit du `debut` du successeur et le trou est un FAIT. Le forcer à la
-- contiguïté inventerait trois ans de mandat. La règle ci-dessus ne recolle donc
-- que ce que ce trigger a lui-même découpé — jamais ce que quelqu'un a établi.

create or replace function public.autorites_synchroniser_historique_chefs()
returns trigger
language plpgsql
-- SECURITY DEFINER : l'historique doit suivre le parent quoi qu'il arrive. En
-- invoker, une écriture sur `autorites_coutumieres` par un rôle qui ne passe pas
-- `est_admin()` ferait échouer l'insert dans l'historique et donc la sauvegarde
-- entière. L'élévation est nulle en pratique : la fonction n'écrit que des
-- valeurs tirées de NEW, sur la seule autorité qu'on vient déjà d'avoir le droit
-- de modifier.
security definer
set search_path to 'public'
as $function$
declare
  v_nouveau      text;
  v_ancien       text;
  v_ouverte      public.chefs_autorites_coutumieres%rowtype;
  v_fin_max      date;
  v_bascule      date;
  v_arrete_borne date;   -- date de l'arrêté bornée à aujourd'hui, NULL si pas d'arrêté
  v_debut_cible  date;   -- `debut` retenu pour la période en cours (branche « report »)
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

  -- 🔴 Défaut 1 — LA borne, calculée UNE fois pour les trois branches qui
  -- écrivent `debut`. Une date de nomination saisie dans le futur (2032 pour
  -- 2023, coquille banale sur un champ date sans `max`) ouvrirait la période
  -- dans neuf ans et laisserait un TROU d'ici là : aucun chef en fonction, donc
  -- un tiret à l'écran. C'est-à-dire exactement le défaut que tout ce chantier
  -- corrige, réintroduit par une faute de frappe.
  --
  -- Le `case` explicite est indispensable : `least(NULL, current_date)` rend
  -- `current_date`, pas NULL. Sans lui, « arrêté inconnu » deviendrait « prise
  -- de fonction aujourd'hui » et masquerait tous les actes passés.
  v_arrete_borne := case
                      when new.date_arrete is null then null
                      else least(new.date_arrete, current_date)
                    end;

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
    --
    -- 🔴 Défaut 2 — `debut` ne se déplace VERS L'AVANT que si le trou qui en
    -- résulterait peut être refermé. Trois cas, du plus fréquent au plus rare :
    --
    --   · aucune période close (`v_fin_max is null`) : rien à trouer en amont —
    --     c'est le cas nominal, la chefferie n'a qu'une période et on la date
    --     enfin. (`v_ouverte.debut is null` implique ce cas : une période
    --     ouverte vers le passé ne peut pas cohabiter avec une période close,
    --     l'anti-chevauchement l'aurait refusée.)
    --   · le mouvement RECULE ou ne bouge pas : il comble, il ne creuse pas.
    --   · le mouvement AVANCE et le prédécesseur est contigu : sa `fin` est une
    --     déduction de ce `debut` (cf. l'entête), on la recalcule plus bas.
    --
    -- Reste le cas écarté : le mouvement avance alors qu'un écart existe déjà.
    -- La `fin` du prédécesseur ne dépend alors pas de ce `debut` et on ne se
    -- permet pas de la réécrire ; `debut` reste où il est, la métadonnée est
    -- quand même enregistrée. On n'aggrave pas un trou qu'on ne sait pas
    -- refermer sans inventer un fait.
    v_debut_cible := v_ouverte.debut;
    if v_arrete_borne is not null
       and (v_fin_max is null or v_arrete_borne > v_fin_max) then
      if v_fin_max is null
         or v_ouverte.debut is null
         or v_arrete_borne <= v_ouverte.debut
         or v_fin_max = v_ouverte.debut - 1 then
        v_debut_cible := v_arrete_borne;
      end if;
    end if;

    update chefs_autorites_coutumieres set
      numero_arrete_nomination = new.numero_arrete_nomination,
      date_arrete              = new.date_arrete,
      autorite_signataire      = new.autorite_signataire,
      debut                    = v_debut_cible
    where id = v_ouverte.id;

    -- Et on recolle le prédécesseur, dont la `fin` avait été déduite du `debut`
    -- qu'on vient de déplacer.
    --
    -- ⚠️ L'ORDRE EST OBLIGATOIRE : la période en cours doit AVOIR DÉJÀ reculé
    -- avant qu'on n'allonge le prédécesseur, sinon les deux se recouvrent le
    -- temps d'une instruction et `chefs_autorites_sans_chevauchement` fait
    -- échouer la sauvegarde de l'écran.
    --
    -- Le `where fin = v_fin_max` ne peut désigner qu'UNE ligne : deux périodes
    -- closes le même jour se chevaucheraient, ce que la garde interdit.
    if v_fin_max is not null
       and v_ouverte.debut is not null
       and v_debut_cible > v_ouverte.debut
       and v_fin_max = v_ouverte.debut - 1 then
      update chefs_autorites_coutumieres
         set fin = v_debut_cible - 1
       where autorite_coutumiere_id = new.id
         and fin = v_fin_max;
    end if;

    return null;
  end if;

  -- ── Chef effacé ────────────────────────────────────────────────────────────
  --
  -- Vider la case « Chef » efface un affichage, ça n'établit pas une fin de
  -- mandat. Poser une `fin` ici inventerait une date de départ que personne n'a
  -- fournie, et laisserait la chefferie sans chef en fonction — donc un tiret
  -- sur tous ses actes récents. On ne touche à rien : l'historique reste le
  -- dernier fait constaté.
  if v_nouveau is null then
    return null;
  end if;

  -- ── Même personne, écriture corrigée ──────────────────────────────────────
  --
  -- « Nanan Kouassi » → « NANAN KOUASSI » n'est pas une succession. Sans ce
  -- test, une simple mise en forme clôturerait un mandat et en ouvrirait un
  -- second au même nom.
  --
  -- `debut` n'est volontairement PAS repris ici, contrairement à la branche
  -- « chef inchangé » : on ne sait pas si l'admin corrigeait la casse ou le nom,
  -- et ne pas bouger `debut` ne peut, dans le pire des cas, que laisser une
  -- période trop large — jamais creuser un trou.
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
  -- reprend la sémantique du backfill du 29/07 — `debut` = date de l'arrêté si
  -- elle est connue, NULL sinon. NULL se lit « en fonction depuis une date que
  -- le registre ignore » ; écrire `current_date` à la place affirmerait une
  -- prise de fonction que personne n'a établie, alors qu'on enregistre souvent
  -- un chef en poste depuis des années.
  --
  -- 🔴 Défaut 1 : `v_arrete_borne` et non `new.date_arrete`. C'est le chemin de
  -- CreerAutoriteModal (familles/page.tsx:205), qui envoie le chef et la date de
  -- l'arrêté dans le même insert — le plus fréquent des trois, et le seul qui
  -- n'était protégé par rien. `date_arrete` reste la valeur brute : la pièce
  -- garde ce que l'admin a déclaré, seule la déduction est bornée.
  if v_ouverte.id is null and v_fin_max is null then
    insert into chefs_autorites_coutumieres
      (autorite_coutumiere_id, nom, numero_arrete_nomination, date_arrete, autorite_signataire, debut, fin)
    values (new.id, v_nouveau, new.numero_arrete_nomination, new.date_arrete, new.autorite_signataire,
            v_arrete_borne, null);
    return null;
  end if;

  -- ── Succession ─────────────────────────────────────────────────────────────
  --
  -- Date de bascule, dans cet ordre :
  --
  --   1. `date_arrete` quand elle est fournie : c'est la pièce, elle prime sur
  --      la date du clic — bornée à aujourd'hui par `v_arrete_borne`.
  --   2. sinon `current_date` : on ne sait pas dater le changement autrement, et
  --      c'est la seule date dont on soit sûr qu'elle est postérieure au mandat
  --      précédent.
  --
  -- Puis deux planchers, imposés l'un et l'autre par le trigger
  -- anti-chevauchement — c'est ici que la cohabitation se joue :
  --   · strictement après la dernière période close ;
  --   · strictement après la prise de fonction du prédécesseur, sinon sa `fin`
  --     (= bascule − 1) tomberait avant son `debut`.
  v_bascule := coalesce(v_arrete_borne, current_date);

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
  'Maintient chefs_autorites_coutumieres au rythme de autorites_coutumieres.chef : INSERT ouvre la première période, UPDATE qui change le chef clôt le prédécesseur la veille et ouvre le successeur, chef inchangé ne crée jamais de période. Toute prise de fonction déduite est bornée à current_date sur les TROIS branches (une date d''arrêté saisie dans le futur masquerait le chef jusque-là) ; `date_arrete` reste la valeur brute déclarée. Un report d''arrêté ne déplace `debut` vers l''avant que s''il ne creuse aucune fenêtre sans chef — si le prédécesseur est contigu, sa `fin` (qui était déduite de ce `debut`) suit le mouvement. Aucune de ces écritures ne peut faire échouer la sauvegarde de l''écran.';

-- Le trigger lui-même est inchangé (AFTER INSERT OR UPDATE) : `create or replace
-- function` suffit, la redéclarer ne ferait que rouvrir une fenêtre sans trigger.

-- ── 3. 🟠 Hygiène : fermer `anon` sur les deux fonctions trigger ─────────────
--
-- État constaté en production le 29/07, AVANT ce correctif :
--   autorites_synchroniser_historique_chefs
--     {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--   chefs_autorites_sans_chevauchement
--     {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- Ce n'est PAS une fuite, et il faut le dire aussi nettement que le reste :
-- PostgREST refuse les fonctions trigger (404 PGRST202, elles n'ont pas de
-- signature appelable), et un appel direct `select f()` lève « trigger functions
-- can only be called as triggers ». Il n'y a rien à en tirer.
--
-- On les ferme quand même, pour une raison précise : `anon=X` posé par le
-- `alter default privileges` du projet est EXACTEMENT le mécanisme qui a rendu
-- `chef_autorite_a_la_date` appelable par n'importe qui avec la clé publique
-- (§2 de 20260729120000), et le `revoke … from public` qui devait l'en empêcher
-- était inerte. Laisser le même schéma en place sur les fonctions voisines, en
-- se fiant à ce que PostgREST veut bien exposer aujourd'hui, c'est reconduire la
-- dépendance à une protection qu'on ne contrôle pas.
--
-- ⚠️ Aucun effet sur l'exécution : PostgreSQL vérifie le droit EXECUTE d'une
-- fonction trigger à la CRÉATION du trigger, pas à chaque déclenchement. Le
-- grant à `authenticated` est néanmoins conservé — il ne coûte rien et évite de
-- faire dépendre les écritures de l'écran d'un détail d'implémentation du
-- moteur. C'est `anon` qu'on visait.

revoke all     on function public.autorites_synchroniser_historique_chefs() from public;
revoke execute on function public.autorites_synchroniser_historique_chefs() from anon;
grant  execute on function public.autorites_synchroniser_historique_chefs() to authenticated, service_role;

revoke all     on function public.chefs_autorites_sans_chevauchement() from public;
revoke execute on function public.chefs_autorites_sans_chevauchement() from anon;
grant  execute on function public.chefs_autorites_sans_chevauchement() to authenticated, service_role;

-- ── Garde-fou ────────────────────────────────────────────────────────────────
--
-- Le symptôme du défaut 1 se lit directement dans la donnée : une période EN
-- COURS dont la prise de fonction est dans le futur ne désigne aucun chef
-- aujourd'hui. Aucune n'existe au 29/07 (2 périodes en base, Ebimpe), mais ce
-- contrôle porte sur l'état, pas sur le nombre de lignes touchées : il reste
-- vrai à chaque réapplication et il échouera le jour où une telle ligne
-- apparaîtra par un chemin qu'on n'a pas prévu.
--
-- Le second contrôle est la non-régression exigée : l'historique d'Ebimpe est la
-- seule donnée réelle du chantier, et c'est elle qui alimente
-- APFC-EBIMPE-2022-001 sur la page publique.

do $$
declare
  v_futur int;
  v_nanan_fin date;
  v_hobi_debut date;
begin
  select count(*) into v_futur
  from public.chefs_autorites_coutumieres
  where fin is null and debut is not null and debut > current_date;

  if v_futur > 0 then
    raise exception 'Defaut 1 : % periode(s) en cours ont une prise de fonction dans le futur — aucun chef ne sera resolu aujourd''hui pour ces autorites.', v_futur;
  end if;

  select fin into v_nanan_fin
  from public.chefs_autorites_coutumieres
  where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
    and upper(btrim(nom)) = 'NANAN AFFA KOUACHY ALFRED';

  select debut into v_hobi_debut
  from public.chefs_autorites_coutumieres
  where autorite_coutumiere_id = 'a9c32cda-66bb-4f8b-b661-2c0ec0127dcb'::uuid
    and fin is null;

  if v_nanan_fin is distinct from date '2023-05-11' or v_hobi_debut is distinct from date '2023-05-12' then
    raise exception 'Historique d''Ebimpe modifie : NANAN.fin=% (attendu 2023-05-11), chef en cours debut=% (attendu 2023-05-12).', v_nanan_fin, v_hobi_debut;
  end if;
end $$;
