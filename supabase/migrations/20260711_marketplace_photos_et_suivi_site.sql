-- Dette #7 : photos d'annonces (schéma + stockage + galerie publique)
-- Dette #6 : suivi de reconstruction du site monterrain-web (export statique,
-- pas de rebuild automatique possible sans SSH/FTP côté cPanel — voir mémoire
-- deploiement_et_stats_publiques). On se contente ici de signaler à l'admin
-- qu'une republication est due, plutôt que d'automatiser le déploiement.

-- 1. Table des photos, une annonce → plusieurs photos ordonnées.
create table public.photos_annonces (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.annonces_marketplace(id) on delete cascade,
  chemin text not null,
  ordre integer not null default 0,
  cree_le timestamptz not null default now()
);

create index idx_photos_annonces_annonce on public.photos_annonces(annonce_id);

alter table public.photos_annonces enable row level security;

create policy photos_annonces_public_read on public.photos_annonces
  for select
  using (
    exists (
      select 1 from public.annonces_marketplace am
      where am.id = photos_annonces.annonce_id
        and (am.statut = 'active' or am.proprietaire_profile_id = (select auth.uid()))
    )
    or est_admin()
  );

create policy photos_annonces_owner_write on public.photos_annonces
  for all
  using (
    exists (
      select 1 from public.annonces_marketplace am
      where am.id = photos_annonces.annonce_id
        and am.proprietaire_profile_id = (select auth.uid())
    )
    or est_admin()
  )
  with check (
    exists (
      select 1 from public.annonces_marketplace am
      where am.id = photos_annonces.annonce_id
        and am.proprietaire_profile_id = (select auth.uid())
    )
    or est_admin()
  );

-- 2. Ajouter/retirer une photo sur une annonce active = republication (touche
--    publiee_le, réutilisé par le suivi de reconstruction du site plus bas).
create or replace function public.touch_annonce_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annonce_id uuid := coalesce(new.annonce_id, old.annonce_id);
begin
  update public.annonces_marketplace
    set publiee_le = now()
    where id = v_annonce_id and statut = 'active';
  return coalesce(new, old);
end;
$$;

create trigger trg_photos_annonces_touch
after insert or delete on public.photos_annonces
for each row execute function public.touch_annonce_photo();

-- 3. Vue publique des photos, dans l'ordre d'affichage (monterrain-web, anon).
create view public.photos_annonces_publiques
with (security_invoker = true) as
select p.id, p.annonce_id, p.chemin, p.ordre
from public.photos_annonces p
join public.annonces_marketplace am on am.id = p.annonce_id
where am.statut = 'active'
order by p.annonce_id, p.ordre, p.cree_le;

grant select on public.photos_annonces_publiques to anon, authenticated;

-- 4. annonces_publiques : expose la photo de couverture (recréation, ajout de
--    colonne au milieu interdit — même contrainte que pour marketplace_lot_coordonnees).
drop view public.annonces_publiques;

create view public.annonces_publiques
with (security_invoker = true) as
select a.id,
    a.titre,
    a.description,
    a.prix,
    a.usage,
    a.zone,
    a.superficie_m2,
    a.publiee_le,
    l.numero_lot as lot_numero,
    round(l.latitude, 3) as lat_approx,
    round(l.longitude, 3) as lng_approx,
    type_document_annonce(a.lot_id) as document_type,
    (
      select p.chemin from public.photos_annonces p
      where p.annonce_id = a.id
      order by p.ordre asc, p.cree_le asc
      limit 1
    ) as photo_couverture
from public.annonces_marketplace a
join public.lots l on l.id = a.lot_id
where a.statut = 'active';

grant select on public.annonces_publiques to anon, authenticated;

-- 5. Bucket de stockage public pour les photos (lecture publique, écriture
--    restreinte au propriétaire de l'annonce concernée via le préfixe de chemin).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('annonces-photos', 'annonces-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy annonces_photos_public_read on storage.objects
  for select
  using (bucket_id = 'annonces-photos');

create policy annonces_photos_owner_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'annonces-photos'
    and (
      exists (
        select 1 from public.annonces_marketplace am
        where am.id::text = (storage.foldername(name))[1]
          and am.proprietaire_profile_id = (select auth.uid())
      )
      or est_admin()
    )
  );

create policy annonces_photos_owner_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'annonces-photos'
    and (
      exists (
        select 1 from public.annonces_marketplace am
        where am.id::text = (storage.foldername(name))[1]
          and am.proprietaire_profile_id = (select auth.uid())
      )
      or est_admin()
    )
  );

-- 6. Suivi de reconstruction du site marketplace (dette #6) : ligne unique,
--    mise à jour manuellement par l'admin après chaque redeploy cPanel.
create table public.marketplace_etat_site (
  id boolean primary key default true check (id),
  derniere_reconstruction timestamptz,
  reconstruit_par uuid references public.profiles(id)
);

insert into public.marketplace_etat_site (id) values (true);

alter table public.marketplace_etat_site enable row level security;

create policy marketplace_etat_site_admin_all on public.marketplace_etat_site
  for all
  using (est_admin())
  with check (est_admin());
