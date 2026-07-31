-- ═══════════════════════════════════════════════════════════════════════════
-- S4 — `pv_reunions_famille*` : trois policies accordees sur le seul groupe,
--      desormais bornees au perimetre reel de l'appelant
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MOTIF
--
-- Trois policies n'avaient AUCUN filtre territorial — le groupe suffisait :
--
--   pv_famille_chefferie_read          (pv_reunions_famille)
--       est_admin() OR mon_groupe() = 'chefferie'
--   pv_famille_lots_chefferie_read     (pv_reunions_famille_lots)
--       est_admin() OR mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien'])
--   pv_famille_membres_chefferie_read  (pv_reunions_famille_membres)
--       est_admin() OR mon_groupe() = ANY (ARRAY['chefferie','proprietaire_terrien'])
--
-- Mesure du 31/07/2026, emprunt de role, une transaction par identite. Toutes
-- les identites chefferie ET proprietaire_terrien de la production lisaient
-- 21/21 `pv_reunions_famille_lots` et 16/16 `pv_reunions_famille_membres` —
-- y compris 0be830c7-… (cedant integral) et 6155d411-… (AKE, cedant du lot
-- 2aac99cb) — alors qu'un proprietaire_terrien lit 0 ligne de la table MERE
-- `pv_reunions_famille`, deja bornee par `pv_famille_pt_read`.
--
-- Une ligne de `pv_reunions_famille_lots` rattache un LOT a une decision de
-- famille, et `pv_reunions_famille_membres` nomme les personnes presentes et
-- signataires. La table mere etait fermee, ses deux tables filles ouvertes.
--
-- 🔴 CE QUE CE RESSERREMENT COUTE, DIT SANS ARRONDI :
--
--   * Pour la chefferie legitime : RIEN. Les 21 rattachements portent tous
--     sur des lots de la juridiction a9c32cda (mesure : 21/21), les 13 PV et
--     les 16 membres aussi. e7091e37-… lit 13/21/16 avant ET apres.
--
--   * Pour un proprietaire_terrien : 21 rattachements et 16 membres perdus,
--     et la branche legitime qui les lui rendrait est aujourd'hui
--     INEXERCABLE — `familles.attributaire_id` est NULL pour la seule
--     famille concernee (2f980fc3-…), donc `ma_famille_attributaire_id()`
--     rend NULL pour les QUATRE comptes proprietaire_terrien de la
--     production. Ils passent tous a 0. C'est exactement le comportement
--     qu'ils ont deja sur la table mere, ou `pv_famille_pt_read` applique le
--     meme critere depuis l'origine : la coherence est retablie, pas inventee.
--     Renseigner `familles.attributaire_id` rouvrira la branche sans toucher
--     a la policy.
--
--   * En stock aujourd'hui, la fuite est REELLE EN DROIT et INERTE POUR UN
--     CEDANT TITULAIRE D'UN COMPTE : les 21 lots rattaches ont tous une
--     attribution passee, mais AUCUN de ces attributaires passes n'a de
--     profil utilisateur (mesure : jointure `profiles.attributaire_id` ->
--     0 ligne). Aucun cedant identifie ne lisait donc, par ce chemin, une
--     information sur un bien qu'il a cede. Le resserrement ferme un droit,
--     il ne retire pas une fuite constatee.
--
-- CHOIX TECHNIQUE — pourquoi une fonction et non un sous-select
--
-- Une policy sur `pv_reunions_famille_lots` qui interrogerait directement
-- `pv_reunions_famille` entrerait en collision avec `pv_famille_commissaire_read`,
-- qui fait deja le trajet inverse (mere -> filles) : PostgreSQL detecterait
-- une recursion de policy (42P17). Le helper ci-dessous est SECURITY DEFINER
-- et propriete de `postgres` (rolbypassrls = true) : la RLS n'est pas
-- reappliquee a l'interieur, et le cycle ne se forme pas. C'est le meme
-- procede que `lot_ids_commissaire()` et `lot_ids_chefferie()`.

create or replace function public.pv_famille_ids_lisibles()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- proprietaire_terrien : les PV du collectif familial dont il releve.
  -- Meme critere, mot pour mot, que la policy `pv_famille_pt_read` deja en
  -- place sur la table mere. `ma_famille_attributaire_id()` NULL rend la
  -- comparaison NULL, donc EXCLUT la ligne : fail-closed.
  select pv.id
  from pv_reunions_famille pv
  where public.mon_groupe() = 'proprietaire_terrien'::groupe_utilisateur
    and pv.collectif_attributaire_id = public.ma_famille_attributaire_id()
  union
  -- chefferie : les PV rattaches a un lot de SA juridiction. Depuis le
  -- 31/07/2026 `lot_ids_chefferie()` ne rend plus que la juridiction, jamais
  -- la famille — une chefferie sans juridiction rend donc l'ensemble vide.
  select pl.pv_id
  from pv_reunions_famille_lots pl
  where public.mon_groupe() = 'chefferie'::groupe_utilisateur
    and pl.lot_id in (select public.lot_ids_chefferie());
$function$;

-- Regle permanente §5 bis ① : le defaut du moteur accorde EXECUTE a PUBLIC et
-- `alter default privileges` n'y peut rien. Les DEUX revocations, au pluriel.
revoke execute on function public.pv_famille_ids_lisibles() from public, anon;
grant  execute on function public.pv_famille_ids_lisibles() to authenticated, service_role;

comment on function public.pv_famille_ids_lisibles() is
  'PV de reunion de famille lisibles par l''appelant : par le collectif familial pour un proprietaire_terrien (meme critere que `pv_famille_pt_read`), par la juridiction pour une chefferie (`lot_ids_chefferie()`). SECURITY DEFINER pour eviter la recursion de policy entre `pv_reunions_famille` et ses deux tables filles. Cree le 31/07/2026 : les trois policies `pv_reunions_famille*_read` accordaient sur le seul `mon_groupe()`, sans aucun filtre territorial.';

-- ── Table mere ──────────────────────────────────────────────────────────────
-- `pv_famille_pt_read` (proprietaire_terrien) et `pv_famille_commissaire_read`
-- sont deja bornees : on ne touche qu'a la branche chefferie.
alter policy pv_famille_chefferie_read on public.pv_reunions_famille
using (
  est_admin()
  or (mon_groupe() = 'chefferie'::groupe_utilisateur
      and id in (select public.pv_famille_ids_lisibles()))
);

-- ── Rattachements lot <-> PV ────────────────────────────────────────────────
alter policy pv_famille_lots_chefferie_read on public.pv_reunions_famille_lots
using (
  est_admin()
  or (mon_groupe() = any (array['chefferie'::groupe_utilisateur,
                                'proprietaire_terrien'::groupe_utilisateur])
      and pv_id in (select public.pv_famille_ids_lisibles()))
);

-- ── Membres presents / signataires ──────────────────────────────────────────
alter policy pv_famille_membres_chefferie_read on public.pv_reunions_famille_membres
using (
  est_admin()
  or (mon_groupe() = any (array['chefferie'::groupe_utilisateur,
                                'proprietaire_terrien'::groupe_utilisateur])
      and pv_id in (select public.pv_famille_ids_lisibles()))
);
