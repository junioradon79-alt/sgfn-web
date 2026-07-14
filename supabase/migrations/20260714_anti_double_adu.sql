-- Detection de double-attribution ADU (14/07/2026 soir)
--
-- Le cahier des charges "Dashboards partenaires SGNF/TerraCI" (revue du 14/07)
-- identifie la fraude par attributions multiples de la meme parcelle comme le
-- principal vecteur de litige cote autorite coutumiere -- exactement le
-- probleme que la reforme ADU de juillet 2024 a voulu corriger cote Etat
-- (attestation villageoise unilaterale -> ADU cosignee).
--
-- Rien ne l'empechait ici : dossiers_adu n'a ni contrainte ni trigger metier
-- (seul un trigger d'audit existe), et le formulaire de creation
-- (AduDialog.tsx) permet de creer directement un dossier au statut
-- "adu_delivree"/"acd_obtenu" -- deux dossiers concurrents sur le meme lot
-- pouvaient donc tous les deux aboutir sans qu'aucun signal n'alerte personne.
--
-- Meme pattern que bloquer_double_cession()/trg_anti_double_cession sur
-- `cessions` : trigger avec message explicite + index unique partiel en
-- defense structurelle. Verifie en prod (14/07) : aucun doublon existant a
-- reparer avant d'ajouter la contrainte.

-- 1. Trigger : message clair, declenche sur la tentative qui casse la regle.
create or replace function public.bloquer_double_adu()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.statut in ('adu_delivree', 'acd_obtenu') and exists (
    select 1 from dossiers_adu d
    where d.lot_id = new.lot_id
      and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
      and d.statut in ('adu_delivree', 'acd_obtenu')
  ) then
    raise exception 'Ce lot a deja une ADU/ACD delivree par un autre dossier -- verifier avant de poursuivre (risque de double attribution).';
  end if;
  return new;
end; $function$;

create trigger trg_anti_double_adu
  before insert or update on public.dossiers_adu
  for each row execute function public.bloquer_double_adu();

-- 2. Defense structurelle : impossible par construction, meme via un futur
--    backfill SQL qui contournerait le trigger applicatif.
create unique index if not exists dossiers_adu_lot_delivre_uniq
  on public.dossiers_adu (lot_id)
  where statut in ('adu_delivree', 'acd_obtenu');
