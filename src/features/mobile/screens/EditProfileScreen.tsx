"use client";

// Édition du profil **dans** l'app.
//
// Le bouton « Gérer mon profil » ouvrait jusqu'ici /dashboard/profil dans le
// navigateur : sur téléphone, on quittait l'application, on retombait sur une
// mise en page pensée pour un écran large, et le geste de retour ne ramenait
// pas où l'on croyait. Les deux seuls champs qu'un utilisateur peut changer
// lui-même (nom, téléphone) plus le mot de passe tiennent largement ici.
//
// Deux sections, deux enregistrements distincts : changer son numéro et
// changer son mot de passe n'ont ni le même risque ni la même validation, et
// un bouton unique obligerait à ressaisir un mot de passe pour corriger une
// faute de frappe dans son nom.

import { useState, type ReactNode } from "react";
import { KeyRound, Loader2, Eye, EyeOff, Save, ShieldCheck } from "lucide-react";

import { BarHeader } from "../components/MobileHeader";
import { groupeLabel } from "../data/mappers";
import type { MobileProfile } from "../data/useMobileData";

/** Minimum imposé par Supabase Auth sur ce projet — même règle que le web. */
const MDP_MIN = 8;

type Props = {
  profile: MobileProfile | null;
  email: string | null;
  onBack: () => void;
  onSave: (nom: string, telephone: string) => Promise<{ ok: boolean; error?: string }>;
  onChangePassword: (nouveau: string) => Promise<{ ok: boolean; error?: string }>;
  flash: (msg: string) => void;
};

export function EditProfileScreen({ profile, email, onBack, onSave, onChangePassword, flash }: Props) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  // Semis des champs pendant le rendu, pas dans un effet (patron « ajuster
  // l'état pendant le rendu » de react.dev, déjà retenu sur /dashboard/profil) :
  // la règle `react-hooks/set-state-in-effect` est active, et un effet
  // provoquerait en plus un rendu intermédiaire avec des champs vides.
  const [semePour, setSemePour] = useState<string | null>(null);
  if (profile && profile.id !== semePour) {
    setSemePour(profile.id);
    setNom(profile.nom_complet ?? "");
    setTelephone(profile.telephone ?? "");
  }

  const [enregistre, setEnregistre] = useState(false);
  const [erreurInfos, setErreurInfos] = useState<string | null>(null);

  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [voirMdp, setVoirMdp] = useState(false);
  const [changeMdp, setChangeMdp] = useState(false);
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);

  const modifie =
    !!profile &&
    (nom.trim() !== (profile.nom_complet ?? "") || telephone.trim() !== (profile.telephone ?? ""));

  const enregistrerInfos = async () => {
    if (enregistre) return;
    if (!nom.trim()) {
      setErreurInfos("Le nom complet est obligatoire.");
      return;
    }
    setEnregistre(true);
    setErreurInfos(null);
    const res = await onSave(nom, telephone);
    setEnregistre(false);
    if (res.ok) flash("Profil enregistré");
    else setErreurInfos(res.error ?? "L'enregistrement a échoué.");
  };

  const enregistrerMdp = async () => {
    if (changeMdp) return;
    if (mdp.length < MDP_MIN) {
      setErreurMdp(`Le mot de passe doit contenir au moins ${MDP_MIN} caractères.`);
      return;
    }
    if (mdp !== mdp2) {
      setErreurMdp("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setChangeMdp(true);
    setErreurMdp(null);
    const res = await onChangePassword(mdp);
    setChangeMdp(false);
    if (!res.ok) {
      setErreurMdp(res.error ?? "Le changement de mot de passe a échoué.");
      return;
    }
    setMdp("");
    setMdp2("");
    flash("Mot de passe mis à jour");
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-foreground">Gérer mon profil</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Coordonnées et mot de passe</div>
          </div>
        }
      />

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-4 pb-8">
        {/* Ce qui ne se modifie pas soi-même */}
        <SectionLabel>Compte</SectionLabel>
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-panel">
          <ReadOnlyRow label="Adresse e-mail" value={email ?? "—"} separateur />
          <ReadOnlyRow label="Rôle" value={groupeLabel(profile?.groupe)} />
        </div>
        <p className="mt-2 flex gap-2 px-1 text-[11.5px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-px size-[15px] flex-none text-success" strokeWidth={2} />
          Votre e-mail, votre rôle et vos rattachements sont gérés par l&apos;administration SGNF.
        </p>

        {/* Coordonnées */}
        <SectionLabel className="mt-5">Mes coordonnées</SectionLabel>
        <div className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-4 shadow-panel">
          <Field label="Nom complet">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Prénom NOM"
              autoCapitalize="words"
              className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </Field>

          <Field label="Téléphone (facultatif)">
            <input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+225 07 00 00 00 00"
              className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </Field>

          {erreurInfos && (
            <p role="alert" className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-[12.5px] text-danger">
              {erreurInfos}
            </p>
          )}

          <button
            type="button"
            onClick={() => void enregistrerInfos()}
            disabled={enregistre || !modifie}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground shadow-panel disabled:opacity-55"
          >
            {enregistre ? <Loader2 className="size-[18px] animate-spin" /> : <Save className="size-[18px]" />}
            {enregistre ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>

        {/* Mot de passe */}
        <SectionLabel className="mt-5">Mot de passe</SectionLabel>
        <div className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-4 shadow-panel">
          <p className="text-[12px] leading-snug text-muted-foreground">
            {MDP_MIN} caractères minimum. Vous resterez connecté après le changement.
          </p>

          <Field label="Nouveau mot de passe">
            <div className="relative">
              <input
                type={voirMdp ? "text" : "password"}
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 pr-11 text-[14px] text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setVoirMdp((v) => !v)}
                aria-label={voirMdp ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-inset"
              >
                {voirMdp ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </Field>

          <Field label="Confirmer le mot de passe">
            <input
              type={voirMdp ? "text" : "password"}
              value={mdp2}
              onChange={(e) => setMdp2(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </Field>

          {erreurMdp && (
            <p role="alert" className="rounded-xl bg-danger-subtle px-3.5 py-2.5 text-[12.5px] text-danger">
              {erreurMdp}
            </p>
          )}

          <button
            type="button"
            onClick={() => void enregistrerMdp()}
            disabled={changeMdp || !mdp || !mdp2}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-card px-4 py-3 text-[14.5px] font-semibold text-foreground disabled:opacity-55"
          >
            {changeMdp ? <Loader2 className="size-[18px] animate-spin" /> : <KeyRound className="size-[18px]" />}
            {changeMdp ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value, separateur }: { label: string; value: string; separateur?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${separateur ? "border-b border-border" : ""}`}>
      <span className="flex-1 text-[13px] text-muted-foreground">{label}</span>
      <span className="max-w-[58%] truncate text-right text-[13px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 text-[12px] font-bold tracking-[0.03em] text-muted-foreground uppercase ${className}`}>
      {children}
    </div>
  );
}
