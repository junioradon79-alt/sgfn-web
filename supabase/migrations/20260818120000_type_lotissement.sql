-- ============================================================================
--  Type de lotissement : villageois / approuvé / ACD (18/08/2026)
--
--  Demande d'origine (verbatim, propriétaire du projet) :
--
--    « Nous avons 3 types de lotissements que nous aurons à traiter dans le
--    cadre de ce projet:
--    - Lotissements Villageois: ex: Koelea-Accor. Documents requis: APFC,
--      Guide de répartition, PV Guide de répartition, PV vérification
--      physique des lots, etc.
--    - Lotissements approuvés: ex: Brignan-Kakodji. Documents requis: Arrêté
--      d'approbation, Guide de répartition, PV Guide de répartition, PV
--      vérification physique des lots, etc.
--    - Lotissements avec ACD: (pas encore en base). Documents requis: Arrêté
--      ACD, Guide de répartition, PV Guide de répartition, PV vérification
--      physique des lots, etc.
--    Chaque attestation de cession pour chacun de ces types de lotissement a
--    une couleur différente. »
--
--  Décisions déjà tranchées avec le propriétaire (non rouvertes ici) :
--   1. Le type peut ÉVOLUER dans le temps (villageois → approuvé → ACD), pas
--      figé à la création. D'où une colonne mutable + une RPC de transition
--      tracée dans `journal_audit`, plutôt qu'un champ fixé à l'insert.
--   2. Le modèle des pièces foncières (3 tables séparées par type) est hors
--      périmètre ici — Phase B.
--   3. Les couleurs par type sont hors périmètre ici — Phase C.
--
--  Périmètre de cette migration (Phase A) : seulement l'enum, la colonne, le
--  backfill des 2 lotissements actuellement en base, et la RPC admin de
--  transition. Vérifié en lecture seule le 18/08 :
--    - exactement 2 lignes dans `lotissements` : "Koelea-Accor revu"
--      (c0e74efc-5dad-4b38-abe9-bd6f70be9464, lotissement villageois — c'est
--      l'exemple cité par le propriétaire) et "Brignan Kakodji"
--      (8820c6b8-8ced-468f-bbcc-b63542d79621, lotissement approuvé — même
--      exemple). Aucun 3e lotissement, donc aucun cas ambigu à laisser
--      nullable : la colonne peut passer NOT NULL après backfill.
--    - `lotissements` ne porte encore aucune colonne `type_lotissement`.
--    - aucun type déjà nommé `type_lotissement` (ni approchant) en base.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------

create type public.type_lotissement as enum ('villageois', 'approuve', 'acd');

comment on type public.type_lotissement is
  'Statut foncier du lotissement : villageois (APFC), approuvé (arrêté d''approbation) ou ACD (arrêté ACD). Détermine les pièces exigées et, en Phase C, la couleur des attestations.';

-- ---------------------------------------------------------------------------
-- 2. Colonne -- nullable d'abord, backfillée, puis verrouillée NOT NULL
-- ---------------------------------------------------------------------------

alter table public.lotissements
  add column if not exists type_lotissement public.type_lotissement;

update public.lotissements
   set type_lotissement = 'villageois'
 where id = 'c0e74efc-5dad-4b38-abe9-bd6f70be9464' -- Koelea-Accor revu
   and type_lotissement is null;

update public.lotissements
   set type_lotissement = 'approuve'
 where id = '8820c6b8-8ced-468f-bbcc-b63542d79621' -- Brignan Kakodji
   and type_lotissement is null;

-- Garde-fou : si un lotissement (nouveau ou existant, id différent de ceux
-- backfillés ci-dessus) restait NULL, le NOT NULL qui suit ferait échouer
-- toute la migration au lieu de verrouiller silencieusement une valeur
-- devinée. C'est le comportement voulu -- voir l'en-tête : aucune donnée
-- ambiguë n'est devinée ici.
alter table public.lotissements
  alter column type_lotissement set not null;

comment on column public.lotissements.type_lotissement is
  'Statut foncier courant. Mutable dans le temps (villageois -> approuve -> acd) : toute transition passe par definir_type_lotissement() et est tracee dans journal_audit, jamais par un UPDATE direct.';

-- ---------------------------------------------------------------------------
-- 3. RPC admin de transition -- meme garde et meme gabarit de motif que
--    accorder_derogation_apfc()/retirer_derogation_apfc()
--    (supabase/migrations/20260722180000_conditions_generation_attestation.sql),
--    ecriture dans journal_audit au gabarit de signalerIncident()
--    (supabase/functions/generation-document/index.ts) : ancienne_valeur /
--    nouvelle_valeur en jsonb, effectue_par renseigne ici via auth.uid()
--    puisque l'appelant est une session admin authentifiee (pas service_role).
-- ---------------------------------------------------------------------------

create or replace function public.definir_type_lotissement(
  p_lotissement_id uuid,
  p_nouveau_type public.type_lotissement,
  p_motif text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ancien_type public.type_lotissement;
begin
  if not public.est_admin() then
    raise exception 'Action reservee aux administrateurs.';
  end if;

  if p_nouveau_type is null then
    raise exception 'Nouveau type de lotissement requis.';
  end if;

  if p_motif is null or length(btrim(p_motif)) < 10 then
    raise exception 'Motif requis (10 caracteres minimum).';
  end if;

  select type_lotissement into v_ancien_type
  from lotissements
  where id = p_lotissement_id;

  if not found then
    raise exception 'Lotissement introuvable : %', p_lotissement_id;
  end if;

  update lotissements
     set type_lotissement = p_nouveau_type
   where id = p_lotissement_id;

  insert into journal_audit (table_concernee, enregistrement_id, action, ancienne_valeur, nouvelle_valeur, effectue_par)
  values (
    'lotissements',
    p_lotissement_id,
    'TYPE_LOTISSEMENT_MODIFIE',
    jsonb_build_object('type_lotissement', v_ancien_type),
    jsonb_build_object('type_lotissement', p_nouveau_type, 'motif', btrim(p_motif)),
    auth.uid()
  );
end;
$$;

comment on function public.definir_type_lotissement(uuid, public.type_lotissement, text) is
  'Admin uniquement. Change le type foncier d''un lotissement (villageois/approuve/acd) et trace la transition dans journal_audit (ancien type, nouveau type, motif, qui, quand). Motif obligatoire (10 caracteres minimum, meme seuil que accorder_derogation_apfc).';

revoke all on function public.definir_type_lotissement(uuid, public.type_lotissement, text) from public, anon;
grant execute on function public.definir_type_lotissement(uuid, public.type_lotissement, text) to authenticated;
