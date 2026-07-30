-- =====================================================================
-- BORNAGE avant ouverture : le cedant ne doit plus rien obtenir sur le
-- bien cede, et le registre des lots verifiables cesse d'etre universel.
--
-- Consigne d'origine (user, 29/07/2026) :
--   « Toute attestation generee devra pouvoir etre lisible (simple
--     lecture) par les parties concernees. En cas de changement de
--     propriete, LE CEDANT NE DOIT PLUS POUVOIR OBTENIR DES INFORMATIONS
--     SUR LE BIEN CEDE. »
--
-- Cette migration ne fait PAS l'ouverture de lecture aux parties (lot 2).
-- Elle ferme d'abord, parce que sur ce depot les policies fuient dans le
-- sens large : ouvrir avant de borner elargirait une fuite.
--
-- Le signal de bascule retenu (arbitrage du user) est `attributions.actuel`.
-- C'est le SEUL qui existe reellement dans la base : 0 vente enregistree,
-- 0 attestation `delivree` sur 51, `depuis` NULL sur 474 des 487 lignes
-- d'historique. Toute autre regle serait une regle vide.
--
-- L'historique public nominatif reste ouvert (registre opposable) : la
-- consigne vaut pour les surfaces AUTHENTIFIEES, pas pour le QR public.
--
-- ---------------------------------------------------------------------
-- FUITE 1 — `lots_verifiables()` : SECURITY DEFINER, `execute` accorde a
--   `authenticated`, AUCUNE garde dans le corps. Mesure du 30/07 par
--   emprunt de role : un acquereur sans le moindre droit obtient 49
--   references, un geometre 49, un cedant 49, l'admin 49 — le meme
--   chiffre pour tout le monde, ce qui est la signature d'une absence de
--   perimetre. Or la fonction rend `attestation_reference`, et la
--   reference SUFFIT ensuite a obtenir gratuitement, via l'edge function
--   `verification-qr`, le proprietaire actuel et l'historique complet.
--
--   Corrigee sur le modele de `registre_supervision()` — seule fonction
--   correctement gardee du depot : une garde qui LEVE (errcode 42501)
--   plus un `where` redondant. Les deux, pas l'un ou l'autre : la garde
--   dit non a qui n'a aucun perimetre, le `where` borne qui en a un.
--
-- FUITE 2 — policy `documents_read` : il manquait `and a.actuel`. Ses
--   deux soeurs l'ont (`lots_read_scope`, `mes_lot_ids()`) ; elle etait
--   la seule des trois a ne pas l'avoir. Impact MESURE : le cedant AKE
--   AMAFIN NICODEME lisait 1 document sur le lot cede — l'attestation de
--   cession ATT-CESS-2026-00881 en PDF, TELECHARGEABLE, parce que
--   `telecharger-document` lit `documents` avec le jeton de l'appelant
--   puis signe l'URL en `service_role` : la RLS y est l'unique point de
--   controle. Une policy laxiste y devient un PDF telechargeable.
--
-- FUITE 3 — `peut_lire_documents_lotissement()` : meme omission de
--   `actuel`, portee superieure. Sa derniere branche autorisait quiconque
--   a UNE attribution, actuelle ou non, sur UN lot du lotissement, a lire
--   TOUS les documents du lotissement entier.
--
--   ⚠️ A DIRE HONNETEMENT : cette fuite est aujourd'hui LATENTE. La policy
--   `documents_lotissement_read` exige `lotissement_id is not null`, et
--   les 74 documents de la base ont TOUS `lotissement_id` a NULL. Elle ne
--   donne donc 0 ligne aujourd'hui, et le correctif ne changera aucun
--   compteur. Elle est reelle a la seconde ou un document sera rattache a
--   un lotissement — ce que le lot 3 (donnees) fera. On la ferme
--   maintenant, pendant qu'elle ne coute rien, precisement pour qu'elle
--   ne s'ouvre jamais.
--
-- ---------------------------------------------------------------------
-- ARBITRAGE 3 du user : le cedant GARDE les actes ou il figure comme
--   partie et QU'IL A SIGNES — c'est son moyen de preuve. On ne referme
--   donc pas a l'aveugle : la policy garde une branche explicite pour ces
--   actes-la.
--
--   ⚠️ Mesure a ne pas confondre avec un succes : cette branche vaut
--   aujourd'hui pour 0 document. `sig_proprietaire_par` est NULL sur
--   TOUTES les attestations concernees (celle d'AKE AMAFIN comme les 4
--   des lots de N'CHO KOUTOUAN JULES), et leur statut est `generee`, pas
--   `delivree`. Autrement dit : aucun cedant n'a signe quoi que ce soit,
--   donc le durcissement ne retire aujourd'hui aucune preuve a personne.
--   La branche encode la regle pour la suite, elle ne la constate pas.
--
-- ---------------------------------------------------------------------
-- CONTRAINTES DE PRODUCTION respectees :
--   * L'event trigger `evt_fonctions_neuves_fermees_a_anon` va se
--     declencher sur chaque `create or replace function` ci-dessous et
--     executer `revoke execute ... from public`. C'est voulu, on ne le
--     desarme pas. Il ne retire QUE l'aclitem PUBLIC, jamais un grant
--     nomme : `lots_verifiables` et `peut_lire_documents_lotissement`
--     ont deja `{postgres=X,authenticated=X,service_role=X}` (aucun
--     PUBLIC, aucun `anon`), leur ACL survit intacte. Les `grant` de fin
--     de fichier sont malgre tout reecrits : idempotents, et ils rendent
--     la migration rejouable sans dependre de l'ACL en place.
--   * Le controle horaire `securite-exposition-anon` rend 0 ecart. La
--     seule fonction NEUVE de cette migration
--     (`est_signataire_acte_du_lot`) n'est accordee qu'a
--     `authenticated` : elle n'entre donc dans aucune des listes de
--     reference de 20260730040000 / 050000, qui n'enumerent que ce qui
--     est atteignable par `anon`. Aucune ligne de base a mettre a jour.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ARBITRAGE 3 — l'acte signe par le cedant lui reste acquis
-- ---------------------------------------------------------------------
-- SECURITY DEFINER a dessein : appelee DEPUIS une policy, elle serait
-- sinon evaluee sous la RLS de `attestations_cession` /
-- `attestations_attribution_lot`, et un refus silencieux a ce niveau-la
-- ferait perdre au cedant une preuve qu'on entend justement lui laisser.
--
-- Le rapprochement se fait sur la REFERENCE contenue dans `url_fichier`
-- (verifie : le document d'AKE AMAFIN pointe
-- `attestations_cession/ATT-CESS-2026-00881.pdf`) et non sur le seul
-- `lot_id`. Sur le seul lot, un cedant ayant signe UNE attestation
-- recupererait TOUTES les attestations du lot, y compris celles de son
-- successeur : ce serait rouvrir la fuite par la porte de l'exception.
create or replace function public.est_signataire_acte_du_lot(
  p_lot_id uuid,
  p_url_fichier text
)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select p_lot_id is not null
     and p_url_fichier is not null
     and auth.uid() is not null
     and (
       exists (
         select 1 from attestations_cession ac
         where ac.lot_id = p_lot_id
           and ac.sig_proprietaire_par = auth.uid()
           and position(ac.reference in p_url_fichier) > 0
       )
       or exists (
         select 1 from attestations_attribution_lot aal
         where aal.lot_id = p_lot_id
           and aal.sig_proprietaire_par = auth.uid()
           and position(aal.reference in p_url_fichier) > 0
       )
     );
$function$;

comment on function public.est_signataire_acte_du_lot(uuid, text) is
  'Arbitrage user 29/07/2026 : un cedant conserve l''acte ou il figure comme partie ET qu''il a signe, comme moyen de preuve, meme apres la bascule de `attributions.actuel`. Rapprochement par reference contenue dans url_fichier, jamais par lot_id seul.';


-- ---------------------------------------------------------------------
-- 2. FUITE 2 — `documents_read` : ajout du `actuel` manquant
-- ---------------------------------------------------------------------
-- `alter policy` et non `drop`+`create` : pas de fenetre, meme courte,
-- pendant laquelle la table serait sans cette policy, et les roles
-- attaches (PUBLIC) restent ceux d'origine.
alter policy documents_read on public.documents
using (
  est_admin()
  or exists (
    select 1
    from attributions a
    where a.lot_id = documents.lot_id
      and a.actuel                              -- <<< le correctif
      and a.attributaire_id = mon_attributaire_id()
  )
  or public.est_signataire_acte_du_lot(documents.lot_id, documents.url_fichier)
);


-- ---------------------------------------------------------------------
-- 3. FUITE 3 — `peut_lire_documents_lotissement()` : meme omission
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
    or exists (
      select 1
      from attributions a
      join lots l  on l.id = a.lot_id
      join ilots i on i.id = l.ilot_id
      where i.lotissement_id = p_lotissement_id
        and a.actuel                            -- <<< le correctif
        and a.attributaire_id is not null
        and a.attributaire_id
            = (select p.attributaire_id from profiles p where p.id = auth.uid())
    )
  );
$function$;


-- ---------------------------------------------------------------------
-- 4. FUITE 1 — `lots_verifiables()` scopee sur le perimetre de l'appelant
-- ---------------------------------------------------------------------
-- Passage de `language sql` a `language plpgsql` : il fallait pouvoir
-- LEVER. Une fonction qui rend `[]` a qui n'a aucun droit se lit comme
-- « il n'y a rien », alors que la reponse juste est « ce n'est pas pour
-- vous » — et un silence de ce genre est exactement ce qui a laisse
-- passer la fuite pendant trois semaines.
--
-- Perimetre, aligne sur les helpers deja audites du depot :
--   * admin / verificateur ............ tout
--   * attributaire (et sa famille) .... `mes_lot_ids()`, qui porte deja
--                                       `and a.actuel` — c'est par la que
--                                       le cedant sort du registre
--   * operateur ....................... lotissements dont il est operateur
--   * chefferie ....................... lotissements de sa juridiction
--   * commissaire ..................... lotissements dont il tient le PV
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
  v_fam    uuid  := public.ma_famille_attributaire_id();
  v_op     uuid  := public.mon_operateur_id();
  v_comm   uuid  := public.mon_commissaire_id();
  v_aut    uuid  := (select p.autorite_coutumiere_id from profiles p where p.id = auth.uid());
  v_res    jsonb;
begin
  v_tout := public.est_admin() or v_groupe = 'verificateur';

  -- Garde qui LEVE — modele `registre_supervision()`.
  if not (v_tout
          or v_attr is not null
          or v_fam  is not null
          or v_op   is not null
          or v_comm is not null
          or v_aut  is not null) then
    raise exception 'Registre des lots verifiables : reserve aux parties d''un lot (attributaire actuel, operateur, chefferie, commissaire) et a la supervision.'
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
    -- `where` REDONDANT avec la garde : la garde dit non a qui n'a aucun
    -- perimetre, celui-ci borne qui en a un. Retirer l'un des deux
    -- suffirait a rouvrir la fuite ; c'est pour cela qu'il y en a deux.
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
  'Registre des lots verifiables, BORNE au perimetre de l''appelant depuis le 30/07/2026. Avant cette date : aucune garde, 49 references rendues indifferemment a un acquereur sans droit, a un geometre et a un cedant — et la reference suffit a obtenir gratuitement le proprietaire actuel via verification-qr.';


-- ---------------------------------------------------------------------
-- 5. Grants — reecrits apres coup, l'event trigger ayant revoque PUBLIC
-- ---------------------------------------------------------------------
-- Aucun `anon` ici, volontairement : le controle horaire
-- `securite-exposition-anon` doit continuer a rendre 0 ecart.
grant execute on function public.lots_verifiables() to authenticated;
grant execute on function public.peut_lire_documents_lotissement(uuid) to authenticated;
grant execute on function public.est_signataire_acte_du_lot(uuid, text) to authenticated;
