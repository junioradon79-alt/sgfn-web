-- Consultation QR payante (attestations de cession) — 60 000 FCFA
-- dont 50 000 FCFA pour la chefferie concernée et 10 000 FCFA de commission SGNF.
-- Le parcours amont (scan, identification du document) reste libre ; seul le
-- verdict d'authenticité est bloqué tant que la consultation n'est pas payée.
-- Écrite/gérée par les edge functions (service_role) ; les admins lisent et
-- valident manuellement les paiements hors-ligne depuis le dashboard.

create table public.consultations_qr (
  id uuid primary key default gen_random_uuid(),
  -- ce que le vérificateur a saisi/scanné (référence ou qr_token)
  reference_saisie text not null,
  -- référence canonique du document (permet de retrouver la consultation quel
  -- que soit le mode de saisie : référence imprimée ou jeton QR)
  reference_document text not null,
  type_document text not null default 'attestation_cession',
  -- code court communiqué au vérificateur pour le paiement manuel (guichet)
  code text not null unique,
  -- jeton secret porteur : seul son détenteur peut débloquer le verdict payé
  jeton text not null unique,
  montant_total integer not null default 60000,
  part_chefferie integer not null default 50000,
  commission_sgnf integer not null default 10000,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'initie', 'payee', 'echoue', 'annulee')),
  -- référence agrégateur (cinetpay:<transaction_id>) ou note de l'admin
  reference_externe text,
  payee_le timestamptz,
  cree_le timestamptz not null default now()
);

create index consultations_qr_reference_document_idx
  on public.consultations_qr (reference_document);
create index consultations_qr_statut_idx
  on public.consultations_qr (statut);

alter table public.consultations_qr enable row level security;

-- Aucune policy anon/authenticated hors admin : la table n'est accessible que
-- via les edge functions (service_role, bypass RLS) et le dashboard admin.
create policy consultations_qr_admin_select on public.consultations_qr
  for select to authenticated using (est_admin());

create policy consultations_qr_admin_update on public.consultations_qr
  for update to authenticated using (est_admin()) with check (est_admin());
