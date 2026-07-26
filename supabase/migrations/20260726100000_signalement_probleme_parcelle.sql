-- Signalement d'un problème sur une parcelle depuis l'app mobile.
--
-- Pourquoi une fonction et non une policy INSERT sur `litiges` :
-- la table n'a aujourd'hui qu'une seule policy d'écriture (`litiges_admin_all`).
-- Ouvrir l'insertion directe aux détenteurs de lot les laisserait renseigner
-- eux-mêmes `statut`, `cree_par` ou `commissaire_id` — c'est-à-dire ouvrir un
-- dossier au nom d'un autre, ou le créer déjà clos. La fonction fixe ces
-- colonnes et ne laisse à l'appelant que l'objet et la description.

create or replace function public.signaler_probleme_parcelle(
  p_lot_id uuid,
  p_objet text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_objet text := btrim(coalesce(p_objet, ''));
  v_notes text := nullif(btrim(coalesce(p_description, '')), '');
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  if v_objet = '' then
    raise exception 'L''objet du signalement est obligatoire.' using errcode = '22023';
  end if;

  -- Fail-closed : on ne signale que sur un lot réellement détenu, à titre
  -- personnel ou par sa famille. Si l'un des deux identifiants est NULL, la
  -- comparaison ne vaut pas `true` et l'accès est refusé — c'est voulu.
  if not exists (
    select 1
    from attributions a
    where a.lot_id = p_lot_id
      and a.actuel
      and a.attributaire_id in (mon_attributaire_id(), ma_famille_attributaire_id())
  ) then
    raise exception 'Ce lot ne vous est pas rattaché.' using errcode = '42501';
  end if;

  -- Idempotence. Sur un téléphone, un double appui ou un renvoi après coupure
  -- réseau ne doit pas ouvrir deux dossiers pour un même fait : on rend celui
  -- qui est déjà ouvert plutôt que d'en créer un second.
  select l.id into v_id
  from litiges l
  where l.lot_id = p_lot_id
    and l.cree_par = v_uid
    and l.statut = 'ouvert'
    and lower(l.objet) = lower(v_objet)
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into litiges (lot_id, objet, notes, statut, cree_par)
  values (p_lot_id, v_objet, v_notes, 'ouvert', v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.signaler_probleme_parcelle(uuid, text, text) is
  'Ouvre un litige sur un lot détenu par l''appelant (app mobile). Fixe statut et cree_par côté serveur ; idempotente sur (lot, auteur, objet) tant que le dossier est ouvert.';

-- La fonction est le seul chemin d'écriture : personne ne l'exécute en anonyme.
revoke all on function public.signaler_probleme_parcelle(uuid, text, text) from public, anon;
grant execute on function public.signaler_probleme_parcelle(uuid, text, text) to authenticated;

-- Sans cette policy, l'auteur d'un signalement ne le reverrait jamais : la
-- lecture des litiges est réservée aux admins, commissaires, chefferies et
-- propriétaires terriens. Un acquéreur détenteur d'un lot aurait vu son
-- signalement disparaître de l'écran juste après l'avoir envoyé — ce qui
-- l'inviterait à le refaire, et à encombrer la file des litiges.
drop policy if exists litiges_auteur_read on public.litiges;
create policy litiges_auteur_read on public.litiges
  for select
  to authenticated
  using (cree_par = (select auth.uid()));
