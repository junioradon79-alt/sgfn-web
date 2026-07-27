"use client";

import { Bell, ShieldAlert } from "lucide-react";

import { PrimaryHeader } from "../../components/MobileHeader";
import { ListeSaisies } from "../../components/ListeSaisies";
import { prenom } from "../../data/mappers";
import { chefferieSansJuridiction, libelleRole, type EcranSaisie } from "../../roles";
import type { MobileProfile } from "../../data/useMobileData";

// Écran racine des rôles métier qui écrivent dans le registre sans piloter le
// national (`operateur_saisie`, `chefferie`).
//
// Il porte la cloche des notifications, et ce n'est pas décoratif : jusqu'ici
// seuls `HomeScreen` (citoyen) et `PilotageScreen` (admin) y donnaient accès.
// Un rôle sans l'un de ces deux onglets n'aurait eu AUCUN moyen de lire ses
// notifications.

type Props = {
  profile: MobileProfile | null;
  unreadNotif: boolean;
  onOpenNotifications: () => void;
  /** Formulaires ouverts au rôle — cf. `saisiesPour`, miroir de la garde serveur. */
  saisies: EcranSaisie[];
  onOuvrirSaisie: (ecran: EcranSaisie) => void;
};

export function SaisieScreen({
  profile,
  unreadNotif,
  onOpenNotifications,
  saisies,
  onOuvrirSaisie,
}: Props) {
  const bloquee = chefferieSansJuridiction(profile?.groupe, profile?.autorite_coutumiere_id);

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <PrimaryHeader
        right={
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <Bell className="size-5" strokeWidth={1.9} />
            {unreadNotif && (
              <span className="absolute top-1.5 right-2 size-2.5 rounded-full border-2 border-primary bg-warning" />
            )}
          </button>
        }
      >
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[18px] font-extrabold tracking-[0.12em]">SGNF</span>
          <span className="pt-0.5 text-[10px] font-semibold tracking-wide opacity-70">Registre</span>
        </div>
        <div className="mt-4">
          <div className="text-[13px] opacity-80">Bonjour,</div>
          <div className="text-[23px] font-bold leading-tight">{prenom(profile?.nom_complet)}</div>
          <div className="mt-0.5 text-[12px] opacity-75">{libelleRole(profile?.groupe)}</div>
        </div>
      </PrimaryHeader>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-[18px] pb-6">
        {bloquee ? (
          // Laisser saisir serait cruel : `soumettre_saisie` force
          // `autorite_coutumiere_id` à `ma_chefferie_id()`, nul ici, et rejette
          // toute modification hors juridiction. La fiche serait perdue à
          // l'envoi, après avoir été remplie en entier.
          <div className="rounded-[22px] border border-brick/45 bg-brick-subtle p-4 shadow-panel">
            <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
              <ShieldAlert className="size-[18px] text-brick" strokeWidth={2} />
              Compte non rattaché
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Votre compte n&apos;est rattaché à aucune chefferie. La saisie dans le registre
              est liée à une juridiction : sans rattachement, le serveur refuserait chaque
              envoi.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              Contactez l&apos;administration du SGNF pour faire rattacher votre compte à
              votre autorité coutumière.
            </p>
          </div>
        ) : (
          <>
            <div className="text-[15px] font-bold text-foreground">Saisir dans le registre</div>
            <p className="mt-1 mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
              Rien n&apos;est écrit dans le registre avant approbation par un administrateur.
              Votre saisie part dans la file de validation nationale.
            </p>
            <ListeSaisies ecrans={saisies} onOuvrir={onOuvrirSaisie} />
          </>
        )}
      </div>
    </div>
  );
}
