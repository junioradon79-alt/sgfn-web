-- ============================================================================
--  Attestation d'Attribution de Lot -- schema (Niveau 2/3, 23/07/2026)
--
--  Nouveau document, distinct de l'Attestation de cession (Niveau 1) :
--  signe par la Chefferie, UNIQUE PAR LOT POUR TOUJOURS (mis a jour en place a
--  chaque transfert ulterieur, jamais recree -- cf. plan
--  mutable-snacking-whale.md). Remplace l'attestation de cession comme
--  document de reference des qu'il existe.
-- ============================================================================

alter type public.type_document add value if not exists 'attestation_attribution';
alter type public.type_paiement add value if not exists 'signature_attribution_lot';
alter type public.type_demarche add value if not exists 'signature_attribution_lot';

create sequence public.seq_attestation_attribution;

create table public.attestations_attribution_lot (
  id                          uuid primary key default extensions.uuid_generate_v4(),
  lot_id                      uuid not null unique references public.lots(id),
  reference                   text not null unique,
  qr_token                    text unique,
  statut                      public.statut_att_cession not null default 'generee',
  niveau                      smallint not null default 2 check (niveau in (2,3)),

  attribution_id              uuid references public.attributions(id),
  titulaire_attributaire_id   uuid not null references public.attributaires(id),

  -- Saisi manuellement a la generation (nom trouve lors de l'identification
  -- physique) -- documentaire (imprime sur le PDF), ne pilote plus la
  -- gratuite de la consultation QR (clause noms-identiques retiree le 23/07 :
  -- la generation/signature est desormais conditionnee par un paiement, pas
  -- par une comparaison de noms).
  nom_identifie_physique      text,
  gratuite                    boolean not null default true,   -- = (niveau = 2)

  -- Paiement de signature Chefferie (500 000 FCFA chefferie + 50 000 FCFA
  -- commission SGNF) confirme pour le cycle de signature EN COURS. Remis a
  -- null a chaque transition Niveau 3 (nouvelle signature = nouveau paiement,
  -- decision actee du 23/07).
  signature_payee_le          timestamptz,

  antecedent_attestation_cession_id uuid references public.attestations_cession(id),
  apfc_id                     uuid references public.attestations_coutumieres(id),

  cree_le                     timestamptz not null default now(),
  promue_niveau3_le           timestamptz,
  maj_le                      timestamptz not null default now(),
  derniere_maj_par            uuid references public.profiles(id),
  historique                  jsonb not null default '[]'::jsonb,

  date_emission               date,
  delivree_le                 timestamptz,
  delivree_par                uuid references public.profiles(id),
  sig_proprietaire_le         timestamptz,
  sig_proprietaire_par        uuid references public.profiles(id),
  sig_operateur_le            timestamptz,
  sig_operateur_par           uuid references public.profiles(id),
  sig_chefferie_le            timestamptz,
  sig_chefferie_par           uuid references public.profiles(id),
  revoquee_le                 timestamptz,
  revoquee_par                uuid references public.profiles(id),
  motif_revocation            text,
  exception                   boolean not null default false,
  exception_motif             text,
  exception_par               uuid references public.profiles(id),
  exception_le                timestamptz,

  constraint attestations_attribution_lot_nom_requis_niveau2
    check (niveau = 3 or nom_identifie_physique is not null)
);

comment on table public.attestations_attribution_lot is
  'Attestation d''Attribution de Lot (Niveau 2/3) -- document unique par lot, mis a jour en place a chaque transfert, jamais recree. Remplace l''attestation de cession comme document de reference.';

alter table public.attestations_attribution_lot enable row level security;

-- RLS -- copie exacte des 3 policies verifiees sur attestations_cession
-- (attcess_admin_all / attcess_chefferie_read / attcess_read), acquereur_id
-- remplace par titulaire_attributaire_id.
create policy attribution_lot_admin_all on public.attestations_attribution_lot
  for all to public
  using (public.est_admin())
  with check (public.est_admin());

create policy attribution_lot_chefferie_read on public.attestations_attribution_lot
  for select to authenticated
  using (
    public.mon_groupe() = 'chefferie'::groupe_utilisateur
    and exists (
      select 1 from lots l
      join ilots i on i.id = l.ilot_id
      join lotissements lo on lo.id = i.lotissement_id
      where l.id = attestations_attribution_lot.lot_id
        and lo.autorite_coutumiere_id = public.ma_chefferie_id()
    )
  );

create policy attribution_lot_read on public.attestations_attribution_lot
  for select to public
  using (
    public.est_admin()
    or titulaire_attributaire_id = public.mon_attributaire_id()
    or (public.mon_groupe() = 'commissaire'::groupe_utilisateur and lot_id in (select public.lot_ids_commissaire()))
  );

-- Triggers generiques existants (memes fonctions que pv_bornage/attestations_cession) :
create trigger trg_qr_token_attribution_lot
  before insert on public.attestations_attribution_lot
  for each row execute function public.generer_qr_token();

create trigger trg_gen_attribution_lot
  after insert on public.attestations_attribution_lot
  for each row execute function public.sgfn_trigger_generation();

create trigger trg_audit_attribution_lot
  after insert or update or delete on public.attestations_attribution_lot
  for each row execute function public.enregistrer_audit();

-- Override PDFMonkey par lotissement, meme patron que pdfmonkey_template_attestation_cession.
alter table public.lotissements
  add column if not exists pdfmonkey_template_attestation_attribution text;

-- Tarif national du paiement de signature -- flat (comme le forfait "2e
-- attestation" existant) : le caractere "provisoire" du montant ne change pas
-- la structure (une seule ligne nationale, pas par chefferie).
insert into public.tarifs (type_demarche, montant_min, montant_max, commission_min, commission_max, actif, notes)
values (
  'signature_attribution_lot', 500000, 500000, 50000, 50000, true,
  'Signature Chefferie de l''Attestation d''Attribution de Lot -- montant provisoire (23/07/2026)'
);

-- Lien paiement <-> attestation d'attribution, miroir de cession_id/vente_id/echeance_id.
alter table public.paiements
  add column if not exists attestation_attribution_id uuid references public.attestations_attribution_lot(id);
