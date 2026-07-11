-- Advisor performance : FK sans index couvrant, introduites par les
-- migrations invitations_famille_autorite et marketplace_photos_et_suivi_site.
create index idx_invitations_autorite_coutumiere_id on public.invitations(autorite_coutumiere_id);
create index idx_invitations_famille_id on public.invitations(famille_id);
create index idx_marketplace_etat_site_reconstruit_par on public.marketplace_etat_site(reconstruit_par);
