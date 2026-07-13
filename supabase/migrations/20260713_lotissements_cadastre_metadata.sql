-- Métadonnées cadastrales du plan (Titre Foncier / Livre Foncier) sur les lotissements.
-- Colonnes additives et nullable : aucun impact sur l'existant, RLS inchangée.
-- Source : plan cadastral officiel (Direction du Cadastre, Bureau d'Abidjan).

alter table public.lotissements
  add column if not exists tf_numero text,
  add column if not exists livre_foncier text,
  add column if not exists centre_cadastral text,
  add column if not exists reference_plan text,
  add column if not exists cedant text,
  add column if not exists beneficiaire_immatriculation text,
  add column if not exists geometre_expert text,
  add column if not exists cabinet_geometre text,
  add column if not exists date_leve_topographique date,
  add column if not exists nb_bornes integer;

comment on column public.lotissements.tf_numero is 'Numero du Titre Foncier (T.F.)';
comment on column public.lotissements.livre_foncier is 'Livre Foncier de rattachement (ex: Anyama)';
comment on column public.lotissements.centre_cadastral is 'Centre cadastral / delimitation (ex: Anyama-Ebimpe)';
comment on column public.lotissements.reference_plan is 'Reference du plan cadastral (ex: KN03-04 ; CF/53-A26)';
comment on column public.lotissements.cedant is 'Cedant de l immatriculation (ex: Etat de Cote d Ivoire)';
comment on column public.lotissements.beneficiaire_immatriculation is 'Demandeur / beneficiaire de l immatriculation figurant sur le plan';
comment on column public.lotissements.geometre_expert is 'Geometre-expert agree ayant leve et dresse le plan';
comment on column public.lotissements.cabinet_geometre is 'Cabinet de geometre (ex: Cabinet C.K.NG, Bouake)';
comment on column public.lotissements.date_leve_topographique is 'Date du leve topographique indiquee sur le plan';
comment on column public.lotissements.nb_bornes is 'Nombre de bornes du perimetre du plan cadastral';

-- Renseignement du lotissement Brignan Kakodji (Ebimpe, Anyama) depuis son plan cadastral.
-- Contenance 68 ha 40 a 31 ca = 684 031 m² (1 ha = 10 000 m², 1 a = 100 m², 1 ca = 1 m²).
update public.lotissements set
  superficie_m2 = 684031,
  superficie_texte = '68 ha 40 a 31 ca',
  livre_foncier = 'Anyama',
  centre_cadastral = 'Anyama-Ebimpe',
  reference_plan = 'KN03-04 ; CF/53-A26',
  cedant = 'État de Côte d''Ivoire',
  beneficiaire_immatriculation = 'Koné Morifère',
  geometre_expert = 'Kouamé N''Guessan',
  cabinet_geometre = 'Cabinet C.K.NG, Bouaké',
  date_leve_topographique = '2026-03-17',
  nb_bornes = 161
where nom = 'Brignan Kakodji';

-- Le demandeur du plan (Koné Morifère) est l'opérateur du lotissement.
-- Creation idempotente de l'operateur puis rattachement du lotissement.
insert into public.operateurs (nom, type)
select 'Koné Morifère', 'operateur'
where not exists (select 1 from public.operateurs where nom = 'Koné Morifère');

update public.lotissements l
set operateur_id = o.id
from public.operateurs o
where o.nom = 'Koné Morifère' and l.nom = 'Brignan Kakodji';
