-- Lot 5a — Boucle vendeur : quand une parcelle SUIVIE passe en vente, prévenir
-- par email les acquéreurs qui la suivent (captage de leads → conversion).
--
-- Utilise le canal email qui FONCTIONNE en prod : table `notifications_a_envoyer`
-- (canal='email') consommée toutes les 10 min par l'edge `envoyer-notifications`
-- via Resend (39 envois réussis à ce jour). Le canal WhatsApp reste bloqué faute
-- de secrets Meta — on ne l'utilise donc pas ici.
--
-- Déclencheur : entrée en statut 'active' d'une annonce (INSERT direct actif, ou
-- passage brouillon→active). Pour chaque suivi du lot non encore notifié
-- (`notifie_le is null`), on enfile un email et on pose `notifie_le` (anti-spam :
-- un suiveur n'est prévenu qu'une fois par lot). Tout est enveloppé d'un garde
-- d'exception : une notification ne doit JAMAIS bloquer une publication d'annonce.

create or replace function public.notif_annonce_active_suivis()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_info jsonb;
  v_lot_txt text;
  v_lieu text;
  s record;
  v_sujet text;
  v_contenu text;
  v_url text;
begin
  -- Seulement à l'entrée en statut 'active'.
  if new.statut is distinct from 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'active' then return new; end if;

  begin
    v_info := public.lot_libelle(new.lot_id);
    v_lot_txt := coalesce(v_info->>'lot', 'votre terrain');
    v_lieu := coalesce(v_info->>'lieu', '');
    v_url := 'https://monterrain.sgfn.ci/annonces/' || new.id || '/';

    for s in
      select id, profile_id from public.suivis_parcelle
      where lot_id = new.lot_id and notifie_le is null
    loop
      v_sujet := 'Un terrain que vous suivez est en vente';
      v_contenu :=
        'Bonjour,' || E'\n\n' ||
        'Le terrain que vous suivez (' || v_lot_txt ||
        case when v_lieu <> '' then ' — ' || v_lieu else '' end ||
        ') vient d''être mis en vente sur TerraCI Market.' || E'\n\n' ||
        'Voir l''annonce : ' || v_url || E'\n\n' ||
        'Vous recevez ce message car vous avez demandé à être prévenu pour ce terrain depuis votre compte SGNF. ' ||
        'SGNF ne vous demandera jamais d''argent ni vos papiers par email.';

      insert into public.notifications_a_envoyer (destinataire_id, canal, sujet, contenu)
      values (s.profile_id, 'email', v_sujet, v_contenu);

      update public.suivis_parcelle set notifie_le = now() where id = s.id;
    end loop;
  exception when others then
    null; -- jamais bloquer une publication d'annonce
  end;

  return new;
end;
$$;

drop trigger if exists trg_notif_annonce_active_suivis on public.annonces_marketplace;
create trigger trg_notif_annonce_active_suivis
  after insert or update of statut on public.annonces_marketplace
  for each row execute function public.notif_annonce_active_suivis();
