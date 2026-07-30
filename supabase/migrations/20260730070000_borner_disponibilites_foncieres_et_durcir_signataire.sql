-- =====================================================================
-- LOT 1 bis — correctifs apres verdict NON CONFORME sur 2bd07bc
--
-- Un verificateur tiers a repasse derriere la migration 20260730060000 et
-- a releve quatre defauts. Trois sont en base et sont traites ici ; le
-- quatrieme est dans les ecrans et est traite dans le meme commit.
--
-- Perimetre CHOISI PAR LE USER. Restent explicitement HORS de ce lot, et
-- renvoyees a un lot separe mesure role par role : les policies
-- `lots_read_scope` (branche famille) et `lots_read_metier`, ainsi que la
-- lecture de `attributions`. Ce sont les autres portes vers le bien cede.
-- Elles ne sont pas fermees ici, et ce fichier ne pretend pas le contraire.
--
-- ---------------------------------------------------------------------
-- DEFAUT 1 — `disponibilites_foncieres()` : la meme fuite, en 9x plus gros
-- ---------------------------------------------------------------------
--
--   SECURITY DEFINER, `execute` accorde a `authenticated`, AUCUNE garde
--   dans le corps : la copie conforme de ce que `lots_verifiables()` vient
--   de perdre. Mesure du 30/07/2026 par emprunt de role, UNE TRANSACTION
--   PAR IDENTITE, temoin `auth.uid()` releve dans la transaction :
--
--     admin 438 | verificateur 438 | acquereur 438 | geometre 438 |
--     commissaire 438 | operateur 438 | operateur_saisie 438 |
--     chefferie 438 | cedant INTEGRAL 438 | cedant PARTIEL 438 |
--     proprietaire terrien sans rattachement 438
--
--   13 identites, 13 fois le meme nombre. Un chiffre identique pour tout
--   le monde n'est pas un droit : c'est l'absence de perimetre. Et parmi
--   ces 438 entrees, 411 sont des lots deja ATTRIBUES (statut `attribue`,
--   detenus par un operateur) — donc pas des disponibilites du tout, mais
--   le registre, avec superficie, numero de parcelle, nature du droit,
--   coordonnees GPS, village et commune.
--
--   ⚠️ MESURE FAITE AVANT D'ECRIRE, parce qu'un ecran qui se vide sans
--   qu'on l'ait prevu est le defaut typique de ce genre de resserrement :
--   `grep -rn disponibilites_foncieres src/ supabase/functions/` ne rend
--   RIEN. Aucun ecran, aucune edge function n'appelle cette RPC. Le seul
--   autre emplacement du depot est `database.types.ts`, qui est genere.
--   Elle n'est donc atteignable que par un appel PostgREST direct. Ce
--   resserrement ne vide aucun ecran : il retire une surface qui n'a plus
--   d'appelant depuis que le catalogue est passe sur
--   `annonces_marketplace` (commit 2bd07bc).
--
--   Corrigee sur le modele de `lots_verifiables()` telle que le lot
--   precedent l'a ecrite — garde qui LEVE (42501) PLUS un `where`
--   redondant, memes helpers de perimetre. Les deux fonctions se
--   ressemblent maintenant ligne pour ligne ; c'est ce qui les rend
--   relisables ensemble.
--
-- ---------------------------------------------------------------------
-- DEFAUT 2 — `est_signataire_acte_du_lot()` : faille structurelle
-- ---------------------------------------------------------------------
--
--   Elle testait `position(ac.reference in p_url_fichier) > 0`. Or
--   `position('' in <quoi que ce soit>)` rend 1, donc `true` — MESURE en
--   production, pas suppose :
--     position('' in 'attestations_cession/ATT-CESS-2026-00881.pdf') = 1
--
--   Et `attestations_cession.reference` est `not null unique` mais SANS
--   aucun CHECK de format ni de longueur : une reference vide y entre.
--   Son signataire lirait alors TOUS les documents du lot — exactement la
--   fuite que cette fonction devait empecher.
--
--   Etat actuel sain : 51 references, toutes de longueur 19, aucune vide.
--   La faille est donc LATENTE, et on la ferme pendant qu'elle ne coute
--   rien. Deux verrous, l'un ne remplacant pas l'autre :
--
--     a) au niveau de la comparaison — on ne cherche plus une sous-chaine
--        n'importe ou, on EXTRAIT le dernier segment du chemin, on lui
--        retire l'extension, et on exige l'EGALITE avec la reference.
--        Verifie sur les 74 documents de la base : 53 produisent un
--        segment egal a une reference connue de `attestations_cession`
--        (ce sont exactement les 53 PDF d'attestation de cession), les 21
--        autres sont des quittances, plans et pieces jointes, pour
--        lesquels l'absence de correspondance est le resultat juste ;
--
--     b) au niveau de la DONNEE — deux CHECK, un par table, qui rendent
--        une reference vide ou trop courte impossible a inserer.
--
--   ⚠️ CE QUE JE NE SAIS PAS, et que je n'invente pas :
--   `attestations_attribution_lot` est VIDE (0 ligne). Le format de ses
--   references est donc INCONNU, et la convention de nommage de
--   `url_fichier` pour ces actes-la l'est tout autant : aucun des 74
--   documents de la base n'en est un. Je n'ai PAS suppose qu'elle
--   ressemble a celle des cessions. Ce que je fais de ce cas :
--     * le verrou (b), la longueur minimale, est INDEPENDANT du format :
--       il protege cette branche des aujourd'hui, quelle que soit la
--       convention retenue plus tard ;
--     * le verrou (a) applique la MEME regle d'extraction qu'aux
--       cessions. Si la convention d'url retenue plus tard differe, la
--       branche rendra `false` — donc FAIL-CLOSED : un cedant perdrait
--       l'acces a un acte qu'il a signe, ce qui se constate et se
--       corrige, au lieu de laisser passer, ce qui ne se constate pas.
--     * DETTE NOMMEE : le jour ou la premiere ligne entrera dans
--       `attestations_attribution_lot`, cette branche devra etre
--       reverifiee contre l'`url_fichier` REELLEMENT produit.
--
-- ---------------------------------------------------------------------
-- DEFAUT 3 — la garde de `lots_verifiables()` refusait des roles que son
--            propre commentaire annoncait couvrir
-- ---------------------------------------------------------------------
--
--   Le commentaire pose en 20260730060000 annoncait « attributaire (et sa
--   famille), operateur, chefferie, commissaire ». Mesure par emprunt de
--   role de l'etat REEL apres ce lot :
--
--     admin 49 | verificateur 49 | chefferie(avec autorite) 49 |
--     cedant partiel 12 | prop. terrien 110 lots -> 4 | cedant integral 0 |
--     operateur AVEC operateur_id 0 |
--     acquereur 42501 | geometre 42501 | commissaire 42501 |
--     operateur SANS operateur_id 42501 | operateur_saisie 42501 |
--     prop. terrien rattache par sa SEULE famille 42501
--
--   Une garde qui refuse un role legitime est un defaut au meme titre
--   qu'une garde qui laisse passer. Trois constats, trois traitements
--   DIFFERENTS — parce qu'ils n'ont pas la meme cause :
--
--   3a. LE COMMISSAIRE — vraie divergence, la garde est CORRIGEE.
--       `registre_supervision()`, la fonction revendiquee comme modele,
--       admet le commissaire PAR SON GROUPE puis le borne dans son
--       `where` (`mon_groupe() = 'commissaire' and
--       lo.pv_commissaire_justice_id = mon_commissaire_id()`).
--       `lots_verifiables()`, elle, exigeait `mon_commissaire_id() is not
--       null` DES LA GARDE. Or l'unique profil `commissaire` de la base a
--       `commissaire_id` a NULL : il recevait 42501 sur l'une et passait
--       sur l'autre. Les deux gardes sont alignees ici sur le modele.
--       ⚠️ Ce que cela ouvre, exactement : RIEN de plus en lignes. Le
--       `where` reste borne sur `v_comm`, qui est NULL — le commissaire
--       obtient donc 0 ligne, ce qui est deja ce que `registre_supervision()`
--       lui rend. On remplace un refus incoherent par un vide coherent.
--
--   3b. LA BRANCHE FAMILLE — le CODE est juste, le COMMENTAIRE etait faux.
--       `ma_famille_attributaire_id()` lit `familles.attributaire_id` via
--       `profiles.famille_id`. Mesure : 22 des 23 familles ont bien un
--       `attributaire_id` — MAIS les 4 seuls profils rattaches a une
--       famille pointent TOUS la meme, `2f980fc3-1be3-442b-ac19-cf61b35a5d4c`,
--       qui est justement celle dont l'`attributaire_id` est NULL. Le
--       helper rend donc NULL pour 100% des comptes de la base, y compris
--       les deux temoins cedants. La branche est INERTE en production.
--       Consequence assumee et ecrite : « Compte Test — Proprietaire
--       terrien » (attributaire_id NULL, famille sans attributaire) passe
--       de 49 lignes a 42501. Ces 49 lignes etaient la fuite, pas un
--       droit : il n'a aucun lot, ni en propre ni par sa famille. La
--       garde n'est donc PAS elargie pour lui ; c'est le commentaire qui
--       est corrige pour cesser de promettre une couverture inerte, et la
--       DETTE DE DONNEE est nommee : renseigner
--       `familles.attributaire_id` sur 2f980fc3 reactivera la branche
--       sans toucher au code.
--
--   3c. `operateur_saisie` ET `operateur` SANS `operateur_id` — refuses,
--       et ils DOIVENT l'etre : aucun helper de perimetre ne rend quoi que
--       ce soit pour eux (`mon_operateur_id()` est NULL sur les deux
--       profils concernes, mesure). Les admettre leur donnerait soit tout,
--       soit rien de plus. Le commentaire cesse de laisser croire que
--       « operateur » suffit : c'est le RATTACHEMENT qui compte, pas le
--       groupe. Et le message d'erreur nomme desormais la cause reelle au
--       lieu d'enumerer des roles.
--
-- ---------------------------------------------------------------------
-- CONTRAINTES DE PRODUCTION respectees
-- ---------------------------------------------------------------------
--   * Event trigger `evt_fonctions_neuves_fermees_a_anon` laisse ARME. Il
--     se declenche sur chacun des trois `create or replace function`
--     ci-dessous et execute `revoke execute ... from public`. Il ne
--     retire que l'aclitem PUBLIC, jamais un grant nomme : les trois
--     fonctions portent `{postgres=X,authenticated=X,service_role=X}`,
--     sans PUBLIC ni `anon`, leur ACL survit. Les `grant` de fin de
--     fichier sont malgre tout rejoues, idempotents, pour que la
--     migration ne depende pas de l'ACL en place.
--   * Controle horaire `securite-exposition-anon` : AUCUNE ligne de base a
--     modifier. Ce fichier ne cree aucune fonction NEUVE (les trois
--     existent deja et sont dans l'etat admis), n'accorde rien a `anon`,
--     ne cree ni table ni vue. Les deux `alter table ... add constraint`
--     ne touchent aucun privilege. Le controle est rejoue apres
--     application et doit rendre 0 ecart.
--   * Aucun `drop`, aucun `delete`, aucun `truncate`, aucun job cron.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. DEFAUT 2 (b) — le verrou de DONNEE : une reference ne peut plus etre
--    vide ni trivialement courte
-- ---------------------------------------------------------------------
-- Volontairement PERMISSIF (>= 8 caracteres apres `btrim`) et non un
-- format fige : il s'agit d'empecher la chaine vide et le caractere
-- isole, pas de graver `ATT-CESS-AAAA-NNNNN` dans le schema. Les
-- references existantes font 19 caracteres (51 sur 51), les deux
-- contraintes valident donc immediatement.
--
-- `attestations_attribution_lot` est vide : sa contrainte valide
-- trivialement, et c'est precisement ce qui la rend utile — elle est
-- posee AVANT la premiere ligne, donc avant qu'un format puisse deraper.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attestations_cession_reference_non_triviale'
      and conrelid = 'public.attestations_cession'::regclass
  ) then
    alter table public.attestations_cession
      add constraint attestations_cession_reference_non_triviale
      check (length(btrim(reference)) >= 8);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'attestations_attribution_lot_reference_non_triviale'
      and conrelid = 'public.attestations_attribution_lot'::regclass
  ) then
    alter table public.attestations_attribution_lot
      add constraint attestations_attribution_lot_reference_non_triviale
      check (length(btrim(reference)) >= 8);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2. DEFAUT 2 (a) — le verrou de COMPARAISON : segment extrait, pas
--    sous-chaine nue
-- ---------------------------------------------------------------------
-- `p_url_fichier` a la forme `attestations_cession/ATT-CESS-2026-00881.pdf`
-- (verifie sur les 74 documents : 8 formes distinctes, dont une a trois
-- segments `plans-lot/<uuid>/<nom>.pdf`). On prend donc le DERNIER segment
-- du chemin, on lui retire l'extension, et on compare par EGALITE.
--
-- Pourquoi l'egalite et non `position(...)` avec une longueur minimale :
-- une longueur minimale empeche la chaine vide mais pas un prefixe. Avec
-- `position`, `ATT-CESS-2026-0088` (18 caracteres, largement au-dessus du
-- seuil) matcherait `ATT-CESS-2026-00881.pdf`. L'egalite sur segment ne
-- laisse pas ce jeu. Les deux verrous sont poses quand meme : le CHECK
-- protege la donnee, l'egalite protege la comparaison.
create or replace function public.est_signataire_acte_du_lot(
  p_lot_id uuid,
  p_url_fichier text
)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  with seg as (
    select nullif(
             regexp_replace(
               regexp_replace(coalesce(p_url_fichier, ''), '^.*/', ''),
               '\.[A-Za-z0-9]+$', ''),
             '') as ref
  )
  select p_lot_id is not null
     and auth.uid() is not null
     and (select ref from seg) is not null
     and (
       exists (
         select 1 from attestations_cession ac
         where ac.lot_id = p_lot_id
           and ac.sig_proprietaire_par = auth.uid()
           and length(btrim(ac.reference)) >= 8
           and ac.reference = (select ref from seg)
       )
       or exists (
         -- Branche NON EXERCEE : la table est vide au 30/07/2026 et la
         -- convention d'url de ces actes est inconnue. Meme regle que
         -- ci-dessus, fail-closed si la convention differe.
         select 1 from attestations_attribution_lot aal
         where aal.lot_id = p_lot_id
           and aal.sig_proprietaire_par = auth.uid()
           and length(btrim(aal.reference)) >= 8
           and aal.reference = (select ref from seg)
       )
     );
$function$;

comment on function public.est_signataire_acte_du_lot(uuid, text) is
  'Arbitrage user 29/07/2026 : un cedant conserve l''acte ou il figure comme partie ET qu''il a signe, comme moyen de preuve, meme apres la bascule de `attributions.actuel`. Rapprochement par EGALITE avec le dernier segment de `url_fichier` prive de son extension — jamais par `position()`, qui rendait vrai pour une reference vide (position('''' in x) = 1), et jamais par `lot_id` seul, qui rendrait aussi les actes du successeur. Branche `attestations_attribution_lot` non exercee : table vide, convention d''url inconnue, a reverifier a la premiere ligne inseree.';


-- ---------------------------------------------------------------------
-- 3. DEFAUT 1 — `disponibilites_foncieres()` bornee au perimetre appelant
-- ---------------------------------------------------------------------
-- Passage de `language sql` a `language plpgsql` pour la meme raison que
-- `lots_verifiables()` : il fallait pouvoir LEVER. Une fonction qui rend
-- `[]` a qui n'a aucun droit se lit comme « il n'y a rien » alors que la
-- reponse juste est « ce n'est pas pour vous ».
--
-- Perimetre — STRICTEMENT le meme que `lots_verifiables()`, memes
-- helpers, meme ordre, pour que les deux se relisent ensemble :
--   * admin / verificateur ........... tout
--   * commissaire (PAR SON GROUPE) ... lotissements dont il tient le PV
--   * attributaire (et sa famille) ... `mes_lot_ids()`, qui porte deja
--                                      `and a.actuel` — c'est par la que
--                                      le cedant sort
--   * operateur RATTACHE ............. ses lotissements
--   * chefferie RATTACHEE ............ sa juridiction
create or replace function public.disponibilites_foncieres()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_groupe text := coalesce(public.mon_groupe()::text, '');
  v_tout   boolean;
  v_attr   uuid := public.mon_attributaire_id();
  v_fam    uuid := public.ma_famille_attributaire_id();
  v_op     uuid := public.mon_operateur_id();
  v_comm   uuid := public.mon_commissaire_id();
  v_aut    uuid := (select p.autorite_coutumiere_id from profiles p where p.id = auth.uid());
  v_res    jsonb;
begin
  v_tout := public.est_admin() or v_groupe = 'verificateur';

  -- Garde qui LEVE — modele `registre_supervision()`.
  -- Le message nomme la CAUSE (aucun rattachement) plutot que d'enumerer
  -- des roles : `operateur` sans `operateur_id` et `operateur_saisie`
  -- sont refuses ici, et un message qui dirait « reserve aux operateurs »
  -- les laisserait croire a un bug.
  if not (v_tout
          or v_groupe = 'commissaire'
          or v_attr is not null
          or v_fam  is not null
          or v_op   is not null
          or v_comm is not null
          or v_aut  is not null) then
    raise exception 'Disponibilites foncieres : votre compte n''est rattache a aucun attributaire, aucun operateur, aucune chefferie et aucun commissaire, et n''appartient pas a la supervision (admin, verificateur). Le catalogue public des terrains en vente est `annonces_marketplace`.'
      using errcode = '42501';
  end if;

  with op as (
    select a.lot_id, att.nom as operateur_nom
    from attributions a
    join attributaires att on att.id = a.attributaire_id
    where a.qualite = 'operateur' and a.actuel = true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lot_id', l.id,
    'lotissement_id', lo.id,
    'ilot', i.numero,
    'lot', l.numero_lot,
    'lotissement', lo.nom,
    'village', lo.village,
    'commune', lo.commune,
    'district', lo.district,
    'est_lot_operateur', (op.lot_id is not null),
    'operateur_nom', op.operateur_nom,
    'superficie_m2', l.superficie_m2,
    'numero_parcelle', l.numero_parcelle,
    'nature_droit', l.nature_droit,
    'lot_latitude', l.latitude,
    'lot_longitude', l.longitude,
    'lz_latitude', lo.latitude,
    'lz_longitude', lo.longitude,
    'lz_superficie_texte', lo.superficie_texte
  ) order by lo.nom, i.numero, l.numero_lot), '[]'::jsonb)
  into v_res
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  left join op on op.lot_id = l.id
  where (l.statut = 'libre' or (op.lot_id is not null and l.statut <> 'vendu'))
    -- `where` REDONDANT avec la garde, exactement comme dans
    -- `lots_verifiables()` : la garde dit non a qui n'a aucun perimetre,
    -- celui-ci borne qui en a un. Retirer l'un des deux suffirait a
    -- rouvrir la fuite ; c'est pour cela qu'il y en a deux.
    and (
      v_tout
      or (v_attr is not null and l.id in (select public.mes_lot_ids()))
      or (v_fam  is not null and l.id in (select public.mes_lot_ids()))
      or (v_op   is not null and lo.operateur_id = v_op)
      or (v_aut  is not null and lo.autorite_coutumiere_id = v_aut)
      or (v_comm is not null and lo.pv_commissaire_justice_id = v_comm)
    );

  return coalesce(v_res, '[]'::jsonb);
end;
$function$;

comment on function public.disponibilites_foncieres() is
  'Disponibilites foncieres, BORNEES au perimetre de l''appelant depuis le 30/07/2026. Avant cette date : aucune garde, 438 entrees rendues a l''identique a 13 identites mesurees (acquereur sans droit, geometre, operateur_saisie, cedant integral compris) — dont 411 lots deja ATTRIBUES, avec superficie, parcelle, nature du droit et coordonnees. Aucun ecran ni edge function ne l''appelle : le catalogue de vente vit sur `annonces_marketplace` depuis le commit 2bd07bc.';


-- ---------------------------------------------------------------------
-- 4. DEFAUT 3 — garde de `lots_verifiables()` alignee sur son modele
-- ---------------------------------------------------------------------
-- Seuls changent : l'admission du commissaire PAR SON GROUPE (3a) et le
-- message d'erreur (3c). Le corps de la requete est inchange, y compris
-- le `where` redondant : le commissaire admis reste borne par
-- `v_comm is not null`, donc a 0 ligne tant que son `commissaire_id` est
-- NULL — meme resultat que `registre_supervision()`.
create or replace function public.lots_verifiables()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_groupe text  := coalesce(public.mon_groupe()::text, '');
  v_tout   boolean;
  v_attr   uuid  := public.mon_attributaire_id();
  -- ⚠️ INERTE EN PRODUCTION au 30/07/2026 : les 4 seuls profils rattaches
  -- a une famille pointent tous `2f980fc3-1be3-442b-ac19-cf61b35a5d4c`,
  -- l'unique famille sur 23 dont `attributaire_id` est NULL. Ce helper
  -- rend donc NULL pour 100% des comptes. La branche encode la regle,
  -- elle ne la constate pas. Dette de DONNEE, pas de code.
  v_fam    uuid  := public.ma_famille_attributaire_id();
  v_op     uuid  := public.mon_operateur_id();
  v_comm   uuid  := public.mon_commissaire_id();
  v_aut    uuid  := (select p.autorite_coutumiere_id from profiles p where p.id = auth.uid());
  v_res    jsonb;
begin
  v_tout := public.est_admin() or v_groupe = 'verificateur';

  -- Garde qui LEVE — modele `registre_supervision()`, y compris pour le
  -- commissaire, admis PAR SON GROUPE puis borne dans le `where`.
  --
  -- Ce que cette garde REFUSE, et qu'il faut lire tel quel : un
  -- `operateur` dont `operateur_id` est NULL, un `operateur_saisie` (idem),
  -- un `geometre`, un `acquereur`, et un proprietaire terrien rattache par
  -- sa seule famille tant que `familles.attributaire_id` reste NULL. Ce
  -- n'est pas le GROUPE qui ouvre, c'est le RATTACHEMENT — sauf pour la
  -- supervision (admin, verificateur, commissaire).
  if not (v_tout
          or v_groupe = 'commissaire'
          or v_attr is not null
          or v_fam  is not null
          or v_op   is not null
          or v_comm is not null
          or v_aut  is not null) then
    raise exception 'Registre des lots verifiables : votre compte n''est rattache a aucun attributaire, aucun operateur, aucune chefferie et aucun commissaire, et n''appartient pas a la supervision (admin, verificateur).'
      using errcode = '42501';
  end if;

  with op as (
    select a.lot_id, att.nom as operateur_nom
    from attributions a
    join attributaires att on att.id = a.attributaire_id
    where a.qualite = 'operateur' and a.actuel = true
  ),
  att_cess as (
    -- attestation la plus recente par lot = celle du proprietaire actuel
    select distinct on (ac.lot_id) ac.lot_id, ac.reference, ac.statut, ac.date_emission
    from attestations_cession ac
    order by ac.lot_id, ac.date_emission desc nulls last
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lot_id', l.id,
    'lotissement_id', lo.id,
    'ilot', i.numero,
    'lot', l.numero_lot,
    'lotissement', lo.nom,
    'village', lo.village,
    'commune', lo.commune,
    'district', lo.district,
    'est_lot_operateur', (op.lot_id is not null),
    'operateur_nom', op.operateur_nom,
    'superficie_m2', l.superficie_m2,
    'numero_parcelle', l.numero_parcelle,
    'nature_droit', l.nature_droit,
    'lot_latitude', l.latitude,
    'lot_longitude', l.longitude,
    'lz_latitude', lo.latitude,
    'lz_longitude', lo.longitude,
    'lz_superficie_texte', lo.superficie_texte,
    'attestation_reference', ac.reference,
    'attestation_statut', ac.statut
  ) order by lo.nom, i.numero, l.numero_lot), '[]'::jsonb)
  into v_res
  from lots l
  join ilots i on i.id = l.ilot_id
  join lotissements lo on lo.id = i.lotissement_id
  join att_cess ac on ac.lot_id = l.id
  left join op on op.lot_id = l.id
  where exists (select 1 from attributions a where a.lot_id = l.id and a.actuel)
    and (
      v_tout
      or (v_attr is not null and l.id in (select public.mes_lot_ids()))
      or (v_fam  is not null and l.id in (select public.mes_lot_ids()))
      or (v_op   is not null and lo.operateur_id = v_op)
      or (v_aut  is not null and lo.autorite_coutumiere_id = v_aut)
      or (v_comm is not null and lo.pv_commissaire_justice_id = v_comm)
    );

  return coalesce(v_res, '[]'::jsonb);
end;
$function$;

comment on function public.lots_verifiables() is
  'Registre des lots verifiables, BORNE au perimetre de l''appelant depuis le 30/07/2026. Avant cette date : aucune garde, 49 references rendues indifferemment a un acquereur sans droit, a un geometre et a un cedant — et la reference suffit a obtenir gratuitement le proprietaire actuel via verification-qr. Garde alignee le 30/07/2026 sur `registre_supervision()` : le commissaire est admis PAR SON GROUPE puis borne par `pv_commissaire_justice_id` (0 ligne tant que son `commissaire_id` est NULL). Refuses, a dessein : `operateur` sans `operateur_id`, `operateur_saisie`, `geometre`, `acquereur`, et le proprietaire terrien rattache par sa seule famille tant que `familles.attributaire_id` est NULL (branche famille inerte en production).';


-- ---------------------------------------------------------------------
-- 5. Grants — rejoues apres coup, l'event trigger ayant revoque PUBLIC
-- ---------------------------------------------------------------------
-- Aucun `anon` ici, volontairement : le controle horaire
-- `securite-exposition-anon` doit continuer a rendre 0 ecart.
grant execute on function public.disponibilites_foncieres() to authenticated;
grant execute on function public.lots_verifiables() to authenticated;
grant execute on function public.est_signataire_acte_du_lot(uuid, text) to authenticated;
