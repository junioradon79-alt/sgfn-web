-- Applied to prod via MCP on 2026-07-14, reconstructed locally on 2026-07-15
-- for parity with supabase_migrations.schema_migrations (not re-applied to prod).
--
-- generer_qr_token() (trigger générique partagé) échouait de façon reproductible
-- sur gen_random_bytes non qualifié pour un tout nouvel appel plpgsql, alors que
-- le même trigger fonctionne pour les tables existantes (attestations_cession...).
-- Contournement : generer_pv_bornage() génère son propre qr_token avec
-- extensions.gen_random_bytes qualifié explicitement, sans toucher à la fonction
-- partagée qui reste utilisée par les autres types de documents.

drop trigger if exists trg_qr_token_pv_bornage on public.pv_bornage;

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
  v_ref text;
  v_id uuid;
begin
  select geometre_id into v_geometre_id from missions_geometre where id = p_mission_id;
  if v_geometre_id is null then
    raise exception 'Mission introuvable.';
  end if;
  if not est_admin() and v_geometre_id <> mon_geometre_id() then
    raise exception 'Non autorise.';
  end if;

  v_ref := 'PV-BORNAGE-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('seq_pv_bornage'))::text, 5, '0');

  insert into pv_bornage (mission_id, reference, qr_token, date_bornage, superficie_mesuree_m2, observations)
  values (p_mission_id, v_ref, encode(extensions.gen_random_bytes(16), 'hex'), p_date_bornage, p_superficie_mesuree_m2, p_observations)
  returning id into v_id;

  return v_id;
end;
$function$;
