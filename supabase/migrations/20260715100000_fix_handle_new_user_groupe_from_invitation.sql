-- Faille : handle_new_user() dérivait le groupe du profil depuis raw_user_meta_data
-- envoyé par le client (signUp), sans jamais vérifier une invitation valide. Comme
-- 'admin' fait partie de l'enum groupe_utilisateur et que est_admin() ne vérifie que
-- profiles.groupe='admin', n'importe qui pouvait s'auto-attribuer un compte admin via
-- un appel direct à l'API (clé anon publique), hors UI /inscription.
--
-- Correctif : le groupe est désormais dérivé uniquement de la ligne invitations
-- (contrôlée par un admin), jamais des métadonnées envoyées par le client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invitation_id uuid;
  v_groupe groupe_utilisateur;
  v_attributaire_id uuid;
  v_commissaire_id uuid;
  v_autorite_coutumiere_id uuid;
  v_famille_id uuid;
begin
  if new.raw_user_meta_data->>'code_invitation' is not null then
    select id, groupe, attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id
      into v_invitation_id, v_groupe, v_attributaire_id, v_commissaire_id, v_autorite_coutumiere_id, v_famille_id
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
    coalesce(v_groupe, 'acquereur'),
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
