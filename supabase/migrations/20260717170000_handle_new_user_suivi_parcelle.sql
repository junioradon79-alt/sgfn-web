-- Captage de leads (suite) : à l'inscription publique acquéreur, enregistrer
-- immédiatement le suivi de la parcelle scannée, passé en metadata
-- (`suivi_reference`). Le profil étant créé dès l'inscription (avant toute
-- confirmation d'email), le suivi survit même si la confirmation diffère l'accès
-- au dashboard — cas où le paramètre ?suivi ne serait pas rejoué.
--
-- Recrée handle_new_user() à l'identique + un bloc final non bloquant. Toute la
-- logique existante (invitation, groupe, rattachements) est inchangée.

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
  v_geometre_id uuid;
  v_suivi_ref text;
  v_lot uuid;
begin
  if new.raw_user_meta_data->>'code_invitation' is not null then
    select id, groupe, attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, geometre_id
      into v_invitation_id, v_groupe, v_attributaire_id, v_commissaire_id, v_autorite_coutumiere_id, v_famille_id, v_geometre_id
    from public.invitations
    where code = new.raw_user_meta_data->>'code_invitation'
      and statut = 'en_attente'
      and expire_le > now();
  end if;

  insert into public.profiles (
    id, nom_complet, telephone, groupe,
    attributaire_id, commissaire_id, autorite_coutumiere_id, famille_id, geometre_id
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', new.email, new.phone, 'Utilisateur'),
    coalesce(new.raw_user_meta_data->>'telephone', new.phone),
    coalesce(v_groupe, 'acquereur'),
    v_attributaire_id,
    v_commissaire_id,
    v_autorite_coutumiere_id,
    v_famille_id,
    v_geometre_id
  )
  on conflict (id) do nothing;

  if v_invitation_id is not null then
    update public.invitations
    set statut = 'utilisee', utilisee_le = now(), utilisee_par = new.id
    where id = v_invitation_id;
  end if;

  -- Captage de leads : suivi de la parcelle scannée (inscription publique).
  -- Non bloquant : un échec ne doit jamais empêcher la création du compte.
  v_suivi_ref := new.raw_user_meta_data->>'suivi_reference';
  if v_suivi_ref is not null then
    begin
      v_lot := public.lot_pour_reference(v_suivi_ref);
      if v_lot is not null then
        insert into public.suivis_parcelle (profile_id, lot_id, source, reference_document)
        values (new.id, v_lot, 'qr', v_suivi_ref)
        on conflict (profile_id, lot_id) do nothing;
      end if;
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$function$;
