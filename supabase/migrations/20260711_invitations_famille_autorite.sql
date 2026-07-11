-- Combler le flux d'invitation Chefferie / Propriétaire terrien (dette #9 du
-- document directeur) : la table invitations ne pouvait pas porter le lien
-- famille/autorité coutumière, un compte invité avec l'un de ces rôles
-- atterrissait sans rattachement (à faire manuellement après coup).

alter table public.invitations
  add column autorite_coutumiere_id uuid references public.autorites_coutumieres(id),
  add column famille_id uuid references public.familles(id);

-- Les deux nouveaux volets de la contrainte sont scopés à statut = 'en_attente' :
-- une invitation encore en attente doit porter le bon rattachement, mais on ne
-- réécrit pas l'historique des invitations déjà utilisées/expirées/révoquées
-- (ex. l'invitation de test manuel.chefferie@sgfn.ci du 03/07, conflatée
-- chefferie/chef de famille à l'époque, cf. conflation_chefferie_chef_famille).
alter table public.invitations drop constraint invitations_check;

alter table public.invitations add constraint invitations_check check (
  (groupe <> all (array['proprietaire'::groupe_utilisateur, 'acquereur'::groupe_utilisateur])
    or attributaire_id is not null)
  and (statut <> 'en_attente' or groupe <> 'chefferie'::groupe_utilisateur
    or autorite_coutumiere_id is not null or famille_id is not null)
  and (statut <> 'en_attente' or groupe <> 'proprietaire_terrien'::groupe_utilisateur
    or famille_id is not null)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invitation_id uuid;
  v_attributaire_id uuid;
  v_commissaire_id uuid;
  v_autorite_coutumiere_id uuid;
  v_famille_id uuid;
begin
  if new.raw_user_meta_data->>'code_invitation' is not null then
    select id, attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id
      into v_invitation_id, v_attributaire_id, v_commissaire_id, v_autorite_coutumiere_id, v_famille_id
    from public.invitations
    where code = new.raw_user_meta_data->>'code_invitation'
      and statut = 'en_attente'
      and expire_le > now();
  end if;

  insert into public.profiles (
    id, nom_complet, telephone, groupe,
    attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', new.email, new.phone, 'Utilisateur'),
    coalesce(new.raw_user_meta_data->>'telephone', new.phone),
    coalesce(new.raw_user_meta_data->>'groupe', 'acquereur')::groupe_utilisateur,
    v_attributaire_id,
    v_commissaire_id,
    v_autorite_coutumiere_id,
    v_famille_id
  )
  on conflict (id) do nothing;

  if v_invitation_id is not null then
    update public.invitations
    set statut = 'utilisee', utilisee_le = now(), utilisee_par = new.id
    where id = v_invitation_id;
  end if;

  return new;
end;
$function$;
