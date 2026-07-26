"use client";

import { useState } from "react";
import Link from "next/link";

import { EditProfileScreen } from "@/features/mobile/screens/EditProfileScreen";
import { ReportIssueScreen } from "@/features/mobile/screens/ReportIssueScreen";
import { NotificationsScreen } from "@/features/mobile/screens/NotificationsScreen";
import type { MobileProfile, Parcelle } from "@/features/mobile/data/useMobileData";
import type { NotifRow } from "@/features/mobile/data/mappers";

/**
 * Aperçu des écrans mobiles — page de développement, jamais servie en prod.
 *
 * Raison d'être, la même que `/apercu-cartes` : ces écrans sont **inatteignables
 * autrement**. Le seul compte de test du projet est un administrateur, donc la
 * coquille choisit `AdminApp` et les écrans citoyen (détail de parcelle,
 * signalement) ne s'ouvrent jamais au navigateur ; et l'état « notification non
 * lue » suppose un état de lecture absent d'une session neuve.
 *
 * 🔴 Ce sont les **vrais composants**, montés avec leurs props réelles — pas des
 * répliques de leur balisage. C'est la seule façon qu'une divergence entre cet
 * aperçu et l'écran réel soit impossible : s'ils rendaient un balisage recopié,
 * un défaut introduit dans l'écran ne se verrait pas ici. Aucune requête,
 * aucune écriture : toutes les fonctions d'envoi sont neutralisées.
 */

const PROFIL: MobileProfile = {
  id: "apercu-0000-0000-0000-000000000001",
  nom_complet: "Konan Yao Bernard",
  telephone: "+225 07 00 00 00 00",
  groupe: "proprietaire_terrien",
  famille_id: null,
  autorite_coutumiere_id: null,
  attributaire_id: null,
};

const PARCELLE: Parcelle = {
  lotId: "apercu-lot-0001",
  numeroLot: "142",
  statut: "attribue",
  ilotNumero: "7",
  lotissement: "Brignan Extension",
  commune: "Songon",
  qualite: "attributaire",
  rang: 1,
  collectif: false,
};

const ilYA = (heures: number) => new Date(Date.now() - heures * 3600 * 1000).toISOString();

/**
 * Types et paramètres **réels**, tels que `decrireNotif` les traduit
 * (`NOTIF_TYPE_LABELS` / `NOTIF_TYPE_TONES` dans `data/mappers.ts`). Un type
 * inventé retomberait sur le libellé générique « Notification » et sur le ton
 * neutre : l'aperçu montrerait quatre lignes grises identiques et ne dirait
 * rien de ce que voit réellement un utilisateur.
 */
const NOTIFS: NotifRow[] = [
  {
    id: "n1",
    type: "acquereur_attestation_prete",
    params: { lot: "Lot 142", lieu: "Brignan Extension" },
    cree_le: ilYA(2),
  },
  {
    id: "n2",
    type: "acquereur_certificat",
    params: { complement: "Votre certificat de vente est disponible." },
    cree_le: ilYA(26),
  },
  {
    id: "n3",
    type: "acquereur_vente_creee",
    params: { lot: "Lot 142", lieu: "Songon" },
    cree_le: ilYA(72),
  },
  {
    id: "n4",
    type: "agence_nouvelle_demande",
    params: { complement: "Un acquéreur s'est manifesté sur une de vos parcelles." },
    cree_le: ilYA(120),
  },
];

/** Les deux premières sont neuves ; les suivantes ont déjà été ouvertes. */
const DEJA_LUES = new Set(["n3", "n4"]);

/** Rien ne part : l'aperçu ne parle jamais à la base. */
const NEANT = async () => ({ ok: true as const });

type Ecran = "profil" | "signalement" | "notifications";

const ECRANS: { cle: Ecran; libelle: string; note: string }[] = [
  { cle: "profil", libelle: "Gérer mon profil", note: "Nom, téléphone, mot de passe — remplace la sortie vers le web" },
  { cle: "signalement", libelle: "Signaler un problème", note: "Création d'un litige depuis le détail d'une parcelle" },
  { cle: "notifications", libelle: "Notifications", note: "2 non lues sur 4 — teinte et compteur" },
];

export default function ApercuMobilePage() {
  const [ecran, setEcran] = useState<Ecran>("profil");
  const [sombre, setSombre] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Aperçu réservé au développement local.{" "}
          <Link href="/" className="font-semibold text-accent underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className={sombre ? "dark" : ""}>
      <div className="min-h-screen bg-background px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Aperçu — écrans mobiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Composants réels, données simulées. Aucune requête, aucune écriture.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {ECRANS.map((e) => (
            <button
              key={e.cle}
              type="button"
              onClick={() => setEcran(e.cle)}
              data-apercu={e.cle}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                ecran === e.cle
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {e.libelle}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSombre((s) => !s)}
            className="ml-auto rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
          >
            {sombre ? "Thème clair" : "Thème sombre"}
          </button>
        </div>

        <p className="mb-3 text-[13px] text-muted-foreground">
          {ECRANS.find((e) => e.cle === ecran)?.note}
        </p>

        {/* Cadre au format téléphone : ces écrans sont en `absolute inset-0`,
            ils ont besoin d'un parent positionné et borné pour se dessiner. */}
        <div
          data-apercu-cadre
          className="relative h-[780px] w-full max-w-[412px] overflow-hidden rounded-[28px] border border-border-strong bg-background shadow-panel"
        >
          {ecran === "profil" && (
            <EditProfileScreen
              profile={PROFIL}
              email="konan.yao@exemple.ci"
              onBack={() => {}}
              onSave={NEANT}
              onChangePassword={NEANT}
              flash={() => {}}
            />
          )}
          {ecran === "signalement" && (
            <ReportIssueScreen
              lotId={PARCELLE.lotId}
              parcelle={PARCELLE}
              onBack={() => {}}
              onSubmit={NEANT}
              onDone={() => {}}
            />
          )}
          {ecran === "notifications" && (
            <NotificationsScreen notifs={NOTIFS} lues={DEJA_LUES} onBack={() => {}} />
          )}
        </div>
      </div>
    </main>
  );
}
