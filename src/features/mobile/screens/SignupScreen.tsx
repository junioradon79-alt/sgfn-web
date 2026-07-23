"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { KeyRound, Loader2, CheckCircle2, Eye, EyeOff, HelpCircle } from "lucide-react";
import { BarHeader } from "../components/MobileHeader";
import { groupeLabel } from "../data/mappers";
import type { InscriptionPayload } from "../data/useMobileData";

type Step = "code" | "form" | "success";

export function SignupScreen({
  onBack,
  onValiderCode,
  onInscrire,
  onLogin,
}: {
  onBack: () => void;
  onValiderCode: (code: string) => Promise<{ valide: boolean; groupe?: string; message?: string; erreur?: boolean }>;
  onInscrire: (p: InscriptionPayload) => Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }>;
  onLogin: () => void;
}) {
  const [step, setStep] = useState<Step>("code");
  const [estPublic, setEstPublic] = useState(false);
  const [code, setCode] = useState("");
  const [groupe, setGroupe] = useState("");

  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepteComm, setAccepteComm] = useState(false);
  const [show, setShow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validerCode = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const res = await onValiderCode(code);
    setLoading(false);
    if (res.erreur) {
      setError("La vérification du code n'a pas abouti. Réessayez.");
      return;
    }
    if (!res.valide) {
      setError(res.message ?? "Ce code d'invitation n'est pas reconnu.");
      return;
    }
    setGroupe(res.groupe ?? "");
    setEstPublic(false);
    setStep("form");
  };

  const passerEnPublic = () => {
    setEstPublic(true);
    setGroupe("acquereur");
    setError(null);
    setStep("form");
  };

  const inscrire = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!nomComplet.trim()) return setError("Veuillez saisir votre nom complet.");
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    setLoading(true);
    setError(null);
    const res = await onInscrire({
      public: estPublic,
      code: estPublic ? undefined : code,
      groupe: estPublic ? undefined : groupe,
      nomComplet,
      telephone,
      email,
      password,
      accepteComm,
    });
    if (!res.ok) {
      setError(res.error ?? "La création du compte a échoué.");
      setLoading(false);
      return;
    }
    // Session immédiate → l'écoute d'auth bascule sur l'espace connecté.
    // Sinon (confirmation e-mail requise) : écran de confirmation.
    if (res.needsConfirm) {
      setStep("success");
      setLoading(false);
    }
  };

  const titre = step === "success" ? "Compte créé" : step === "form" ? "Votre profil" : "Créer un compte";

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={step === "form" && !estPublic ? () => setStep("code") : onBack}
        title={<span className="text-[16px] font-bold text-foreground">{titre}</span>}
      />

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[26px] pt-4 pb-8">
        {/* Progression */}
        <div className={`mb-6 grid gap-2 ${estPublic ? "grid-cols-2" : "grid-cols-3"}`}>
          {(estPublic ? ["Identité", "Confirmation"] : ["Invitation", "Identité", "Confirmation"]).map((label, i) => {
            const idx = estPublic ? (step === "form" ? 0 : 1) : step === "code" ? 0 : step === "form" ? 1 : 2;
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={label}>
                <div className={`h-1 rounded-full ${active || done ? "bg-primary" : "bg-border"}`} />
                <div className={`mt-1.5 text-[11px] font-bold ${active ? "text-foreground" : "text-muted-2"}`}>{label}</div>
              </div>
            );
          })}
        </div>

        {step === "code" && (
          <form onSubmit={validerCode} className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Saisissez le code d&apos;invitation transmis par votre organisation.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-muted-foreground">Code d&apos;invitation</span>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SGNF-XXXXXXXX"
                  required
                  autoCapitalize="characters"
                  className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 pl-9 font-mono tracking-widest text-foreground outline-none focus:border-primary"
                />
              </div>
              <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <HelpCircle className="size-3.5" />
                Fourni par l&apos;administrateur de votre organisation.
              </span>
            </label>

            {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground shadow-panel disabled:opacity-55"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Valider le code
            </button>

            <div className="mt-1 flex flex-col gap-1.5 text-center text-[12.5px]">
              <button type="button" onClick={passerEnPublic} className="font-semibold text-accent">
                Pas de code ? Créer un compte acquéreur
              </button>
              <Link href="/devenir-geometre/" className="text-muted-foreground">
                Vous êtes géomètre-expert ? Faire une demande.
              </Link>
            </div>
          </form>
        )}

        {step === "form" && (
          <form onSubmit={inscrire} className="flex flex-col gap-3.5">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {estPublic ? (
                "Email et mot de passe suffisent. Aucun paiement ni document ne vous sera demandé."
              ) : (
                <>
                  Votre accès sera rattaché à l&apos;espace{" "}
                  <b className="text-foreground">{groupeLabel(groupe)}</b>.
                </>
              )}
            </p>

            <Field label="Nom complet">
              <input
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                placeholder="Prénom NOM"
                required
                className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label={`Téléphone${estPublic ? " (facultatif)" : ""}`}>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+225 07 00 00 00 00"
                className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label="Adresse e-mail">
              <input
                type="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={estPublic ? "vous@email.com" : "vous@organisation.ci"}
                required
                className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
              />
            </Field>

            <Field label="Mot de passe">
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  required
                  className="w-full rounded-lg border border-border-strong bg-inset px-3 py-2.5 pr-11 text-[14px] text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Masquer" : "Afficher"}
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-inset"
                >
                  {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </div>
            </Field>

            {estPublic && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-inset px-3.5 py-3 text-[12.5px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={accepteComm}
                  onChange={(e) => setAccepteComm(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>J&apos;accepte de recevoir des informations de SGNF. Désinscription possible à tout moment.</span>
              </label>
            )}

            {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-primary-foreground shadow-panel disabled:opacity-55"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Créer mon compte
            </button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <span className="flex size-[72px] items-center justify-center rounded-full bg-success-subtle text-success">
              <CheckCircle2 className="size-9" strokeWidth={2.2} />
            </span>
            <div className="text-[19px] font-extrabold text-foreground">Compte créé</div>
            <div className="max-w-[280px] text-[13px] leading-relaxed text-muted-foreground">
              Un lien de confirmation a été envoyé à <b className="text-foreground">{email}</b>. Confirmez-le, puis
              connectez-vous.
            </div>
            <button
              type="button"
              onClick={onLogin}
              className="mt-2 rounded-xl bg-primary px-6 py-3 text-[14.5px] font-semibold text-primary-foreground"
            >
              Aller à la connexion
            </button>
          </div>
        )}
      </div>
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
