-- Ajoute la traçabilité de l'arrêté de nomination du chef de village sur
-- `autorites_coutumieres` — c'est ce document (délivré par le Préfet, au nom
-- du Ministère de l'Intérieur et de la Sécurité, après désignation coutumière)
-- qui confère sa légitimité administrative au chef.
--
-- Le numéro n'obéit à aucune nomenclature nationale unique : chaque
-- préfecture émet sa propre référence (ex. observé dans la presse :
-- « N°017/RW/P.SGLA/CAB » — code région/préfecture + service + séquence).
-- Le champ reste donc du texte libre plutôt qu'un format contraint.
--
-- Toutes les colonnes sont nullable : au 24/07 aucune des autorités déjà
-- enregistrées ne dispose du document, la saisie se fera au fil de la
-- collecte réelle (jamais par valeur devinée).

alter table public.autorites_coutumieres
  add column if not exists numero_arrete_nomination text,
  add column if not exists date_arrete date,
  add column if not exists autorite_signataire text,
  add column if not exists arrete_nomination_scan_url text;
