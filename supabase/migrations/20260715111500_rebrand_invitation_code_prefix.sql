-- Rebranding cosmétique : les nouveaux codes d'invitation sont préfixés SGNF- au lieu
-- de SGFN-. Les codes déjà émis (préfixe SGFN-) restent valides tels quels : la
-- validation compare le code complet, jamais le préfixe.
create or replace function public.generer_code_invitation()
returns text
language sql
set search_path to 'public'
as $function$
  select 'SGNF-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random()*32)::int + 1, 1), '')
  from generate_series(1,8);
$function$;
