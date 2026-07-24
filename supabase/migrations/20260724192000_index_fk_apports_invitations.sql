-- FK sans index sur les colonnes ajoutées par 20260724191000, même convention
-- que les lots A+B de l'audit sécurité (cf. docs/04-DATABASE.md §4).
create index if not exists idx_apports_saisi_par on public.apports (saisi_par);
create index if not exists idx_invitations_collaborateur_id on public.invitations (collaborateur_id);
