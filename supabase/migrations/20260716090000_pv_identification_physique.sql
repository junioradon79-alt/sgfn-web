-- PV d'identification physique du lotissement (= PV de répartition physique,
-- acte constatant l'identification des lots sur le terrain lors du partage
-- entre ayants droit). Distinct du PV du guide de répartition
-- (pv_numero_enregistrement / pv_commissaire_justice_id, enregistrement
-- notarial du guide) et du PV de bornage (pv_bornage, par mission géomètre
-- individuelle). Colonnes additives nullable sur lotissements, même pattern
-- que pv_numero_enregistrement (20260713_lotissements_cadastre_metadata.sql) :
-- pas de RLS à toucher, un update partiel de LotissementForm n'écrase pas ces
-- champs. scan_url pointe vers le bucket de stockage "documents" (même bucket
-- que UploadPlanModal), pas de table documents dédiée.

alter table public.lotissements
  add column pv_identification_physique_numero text,
  add column pv_identification_physique_date date,
  add column pv_identification_physique_scan_url text;
