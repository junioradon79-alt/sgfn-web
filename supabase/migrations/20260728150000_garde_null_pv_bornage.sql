-- 🔴 Dernière occurrence de la faille de garde NULL (#19).
--
-- La migration `20260728130000` avait fermé le trou dans les trois fonctions de
-- constat de signature. Le balayage s'était arrêté aux fonctions du chantier :
-- il en restait une, trouvée par un vérificateur en reprenant la recherche sur
-- les **huit** helpers de rattachement du schéma (`ma_chefferie_id`,
-- `ma_famille_attributaire_id`, `ma_famille_id`, `mon_attributaire_id`,
-- `mon_collaborateur_id`, `mon_commissaire_id`, `mon_geometre_id`,
-- `mon_operateur_id`) et non sur les deux que le chantier utilisait.
--
-- La garde en production :
--
--     if not est_admin() and v_geometre_id <> mon_geometre_id() then
--       raise exception 'Non autorise.';
--
-- Pour un appelant qui n'est ni admin ni géomètre, `mon_geometre_id()` vaut
-- NULL. `v_geometre_id <> NULL` vaut NULL, et `TRUE AND NULL` vaut NULL — qui
-- n'est pas vrai. **L'exception n'est jamais levée** : n'importe quel compte
-- authentifié pouvait générer un PV de bornage sur la mission d'un géomètre.
--
-- Prouvé en production le 28/07, transaction annulée, sur une mission fabriquée
-- dans la transaction (`missions_geometre` est vide) : acquereur, operateur,
-- chefferie et proprietaire_terrien obtenaient tous « PAS DE REFUS — PV CREE ».
--
-- ⚠️ Non exploitable aujourd'hui, faute de mission en base — mais c'est
-- exactement la « protection par ignorance d'un identifiant » que la migration
-- précédente refuse de compter comme un contrôle.
--
-- Le reste de la fonction est repris **à l'identique**.

create or replace function public.generer_pv_bornage(
  p_mission_id uuid,
  p_date_bornage date,
  p_superficie_mesuree_m2 numeric,
  p_observations text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_geometre_id uuid;
  v_mon_geometre uuid;
  v_ref text;
  v_id uuid;
begin
  select geometre_id into v_geometre_id from missions_geometre where id = p_mission_id;
  if v_geometre_id is null then
    raise exception 'Mission introuvable.';
  end if;

  -- 🔴 Le NULL se teste AVANT la comparaison, et porte son propre message :
  -- « non autorisé » enverrait un géomètre légitime mais non rattaché chercher
  -- un problème de droits, là où il lui manque un rattachement.
  if not est_admin() then
    v_mon_geometre := mon_geometre_id();
    if v_mon_geometre is null then
      raise exception 'Votre compte n''est rattache a aucun geometre-expert : le PV de bornage ne peut pas etre genere.';
    end if;
    if v_geometre_id <> v_mon_geometre then
      raise exception 'Cette mission ne vous est pas confiee.';
    end if;
  end if;

  v_ref := 'PV-BORNAGE-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_pv_bornage'))::text, 5, '0');

  insert into pv_bornage (mission_id, reference, qr_token, date_bornage, superficie_mesuree_m2, observations)
  values (p_mission_id, v_ref, encode(extensions.gen_random_bytes(16), 'hex'), p_date_bornage, p_superficie_mesuree_m2, p_observations)
  returning id into v_id;

  return v_id;
end;
$function$;
