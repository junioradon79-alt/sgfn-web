"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import SGFNButton from "@/components/ui/SGFNButton";
import { createClient } from "@/utils/supabase/client";

const GROUPES_LABELS: Record<string, string> = {
  proprietaire: "Propriétaire",
  proprietaire_terrien: "Propriétaire terrien",
  acquereur: "Acquéreur",
  commissaire: "Commissaire",
  amenageur: "Aménageur",
  chefferie: "Chefferie",
  geometre: "Géomètre",
  verificateur: "Vérificateur",
  operateur: "Opérateur",
  agent_ia: "Agent IA",
};

type Step = "code" | "form" | "success";

export default function InscriptionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [groupe, setGroupe] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleValiderCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { data: rpcData, error: rpcError } = await supabase.rpc("valider_invitation", {
      p_code: code.trim().toUpperCase(),
    });

    setIsLoading(false);

    if (rpcError) {
      setError("Erreur de vérification. Veuillez réessayer.");
      return;
    }

    const data = rpcData as { valide: boolean; groupe?: string; message?: string } | null;

    if (!data?.valide) {
      setError(data?.message ?? "Code invalide.");
      return;
    }

    setGroupe(data.groupe as string);
    setStep("form");
  };

  const handleInscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!nomComplet.trim()) {
      setError("Veuillez saisir votre nom complet.");
      setIsLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setIsLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom_complet: nomComplet.trim(),
          telephone: telephone.trim() || null,
          groupe,
          code_invitation: code.trim().toUpperCase(),
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    // Si session immédiate → redirection dashboard
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Sinon → confirmation email en attente
    setStep("success");
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4 py-10 font-sans antialiased">
      <div className="w-full max-w-md rounded-2xl border border-[#E3E8EF] bg-white p-6 sm:p-8">
        {/* En-tête */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D3B66] p-[2px] shadow-sm">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-white">
                <Image
                  src="/logo-embleme.png"
                  alt="SGNF"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                  priority
                />
              </div>
            </div>
            <span className="text-2xl font-black tracking-tight text-[#0D3B66] uppercase">
              SGNF
            </span>
          </div>

          {step === "code" && (
            <>
              <h1 className="font-display text-2xl font-bold text-[#0D3B66]">
                Créer votre compte
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Saisissez le code d&apos;invitation reçu pour commencer.
              </p>
            </>
          )}

          {step === "form" && (
            <>
              <h1 className="font-display text-2xl font-bold text-[#0D3B66]">
                Vos informations
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Espace{" "}
                <span className="font-semibold text-[#0D3B66]">
                  {GROUPES_LABELS[groupe] ?? groupe}
                </span>
              </p>
            </>
          )}

          {step === "success" && (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-7 w-7 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="font-display text-2xl font-bold text-[#0D3B66]">
                Compte créé !
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Un lien de confirmation a été envoyé à{" "}
                <span className="font-medium text-slate-700">{email}</span>.
                Cliquez dessus pour activer votre compte.
              </p>
            </>
          )}
        </div>

        {step !== "success" && (
          <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Progression de l’inscription">
            {[["Invitation", step === "code"], ["Identité", step === "form"], ["Confirmation", false]].map(([label, active], index) => {
              const done = step === "form" && index === 0;
              return <li key={String(label)}><div className={`h-1 rounded-full ${active || done ? "bg-[#0F5E8C]" : "bg-[#E3E8EF]"}`} /><p className={`mt-2 text-xs font-semibold ${active ? "text-[#0B2E4F]" : "text-slate-400"}`}>{done && <Check className="mr-1 inline h-3 w-3" />}{String(label)}</p></li>;
            })}
          </ol>
        )}

        {/* Étape 1 : Code d'invitation */}
        {step === "code" && (
          <form onSubmit={handleValiderCode} className="space-y-5">
            <div>
              <label
                htmlFor="code"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Code d&apos;invitation
              </label>
              <Input
                id="code"
                type="text"
                placeholder="SGNF-XXXXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="font-mono tracking-widest"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <SGFNButton
              type="submit"
              size="lg"
              disabled={isLoading || !code.trim()}
              className="mt-2 w-full rounded-xl bg-[#0D3B66] text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98]"
            >
              {isLoading ? "Vérification..." : "Valider le code"}
            </SGFNButton>
          </form>
        )}

        {/* Étape 2 : Formulaire d'inscription */}
        {step === "form" && (
          <form onSubmit={handleInscription} className="space-y-4">
            <div>
              <label
                htmlFor="nom"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Nom complet <span className="text-red-500">*</span>
              </label>
              <Input
                id="nom"
                type="text"
                placeholder="Prénom NOM"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="telephone"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Téléphone
              </label>
              <Input
                id="telephone"
                type="tel"
                placeholder="+225 07 00 00 00 00"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Adresse e-mail <span className="text-red-500">*</span>
              </label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setStep("code"); setError(""); }}
                className="flex-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ← Retour
              </button>
              <SGFNButton
                type="submit"
                size="lg"
                disabled={isLoading}
                className="flex-1 rounded-xl bg-[#0D3B66] text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98]"
              >
                {isLoading ? "Création en cours..." : "Créer mon compte"}
              </SGFNButton>
            </div>
          </form>
        )}

        {/* Étape 3 : Succès */}
        {step === "success" && (
          <div className="text-center">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-[#0D3B66] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E6091]"
            >
              Aller à la connexion
            </Link>
          </div>
        )}

        {step !== "success" && (
          <p className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-slate-400 transition-colors hover:text-[#1E6091]"
            >
              ← Retour à l&apos;accueil
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
