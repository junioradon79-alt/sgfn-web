-- =====================================================================
-- CORRECTIF AUDIT 24/07 — Fuite #2 : PII inter-profils via peut_contacter
-- =====================================================================
-- Constat (audit docs/AUDIT_2026-07-24.md §2, prouvé par simulation) :
-- peut_contacter() renvoyait `true` inconditionnellement pour les groupes
-- 'acquereur','amenageur','proprietaire'. Couplé à la policy
-- profiles_contact_read, tout acquéreur — qui est le groupe attribué par
-- DÉFAUT à toute auto-inscription — lisait les 20/20 profils (nom + téléphone
-- de tous les acteurs, admins/chefferies compris). Fuite structurelle.
--
-- Modèle métier (doc directeur §4.2) : la mise en relation est MANUELLE et
-- intermédiée par SGNF ; aucune coordonnée n'est publiée automatiquement.
-- Un acquéreur n'a donc besoin de lire QUE :
--   * les profils de l'administration SGNF (groupe 'admin') — son point de
--     contact pour la médiation ;
--   * les personnes avec qui il PARTAGE DÉJÀ une conversation — pour afficher
--     leur nom dans la messagerie (il existe en base 1 conversation
--     acquéreur↔non-admin ; la restreindre aux seuls admins l'aurait cassée).
-- Tout le reste → refus.
--
-- 'amenageur' (fusionné dans 'operateur' le 17/07) et 'proprietaire' (déprécié)
-- ne bénéficient plus de la permission large : refus par défaut, plus sûr pour
-- des rôles qui ne devraient plus recevoir de nouveaux comptes.
--
-- Les branches 'admin' (tout) et 'commissaire' (scopé litiges/attributions)
-- sont inchangées.

create or replace function public.peut_contacter(p_destinataire_id uuid)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_mon_groupe groupe_utilisateur := mon_groupe();
  v_dest_groupe groupe_utilisateur;
  v_dest_attributaire uuid;
begin
  if v_mon_groupe = 'admin' then return true; end if;

  -- Acquéreur : administration SGNF + interlocuteurs de conversation seulement.
  if v_mon_groupe = 'acquereur' then
    select groupe into v_dest_groupe from profiles where id = p_destinataire_id;
    if v_dest_groupe = 'admin' then return true; end if;
    return exists (
      select 1
      from conversation_participants moi
      join conversation_participants lui
        on lui.conversation_id = moi.conversation_id
      where moi.profile_id = (select auth.uid())
        and lui.profile_id = p_destinataire_id
    );
  end if;

  if v_mon_groupe = 'commissaire' then
    select groupe, attributaire_id into v_dest_groupe, v_dest_attributaire
    from profiles where id = p_destinataire_id;

    if v_dest_groupe = 'admin' then return true; end if;

    if v_dest_attributaire is not null and exists(
      select 1 from litiges l
      join attributions a on a.lot_id = l.lot_id
      where l.commissaire_id = mon_commissaire_id()
        and a.attributaire_id = v_dest_attributaire
        and a.actuel
    ) then return true; end if;

    return false;
  end if;

  return false; -- roles non couverts par une regle explicite : refus par defaut
end;
$function$;
