"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
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

// Le flux par invitation a 3 étapes ; le flux grand public (acquéreur) en a 2
// (pas de code à saisir).
const stepsInvitation: { key: Step; label: string }[] = [
  { key: "code", label: "Invitation" },
  { key: "form", label: "Identité" },
  { key: "success", label: "Confirmation" },
];
const stepsPublic: { key: Step; label: string }[] = [
  { key: "form", label: "Identité" },
  { key: "success", label: "Confirmation" },
];

const trustItemsInvitation = [
  "Invitation vérifiée côté serveur",
  "Compte rattaché au rôle de votre organisation",
  "Accès journalisé dans le registre SGNF",
];
const trustItemsPublic = [
  "Compte gratuit, créé en une minute",
  "Soyez prévenu si un terrain suivi est mis en vente",
  "Aucun paiement ni document demandé pour créer le compte",
];

function InscriptionInner() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  // Mode grand public (acquéreur) : ?public=1, éventuellement ?suivi=<référence>
  // pour suivre la parcelle scannée juste après la création du compte.
  const estPublic = searchParams.get("public") === "1";
  const suivi = searchParams.get("suivi");

  const steps = estPublic ? stepsPublic : stepsInvitation;

  const [step, setStep] = useState<Step>(estPublic ? "form" : "code");
  const [code, setCode] = useState("");
  const [groupe, setGroupe] = useState(estPublic ? "acquereur" : "");
  const [nomComplet, setNomComplet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepteComm, setAccepteComm] = useState(false); // consentement, non pré-coché
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
      setError("La vérification du code n'a pas abouti. Réessayez ou contactez votre administrateur.");
      return;
    }

    const data = rpcData as { valide: boolean; groupe?: string; message?: string } | null;

    if (!data?.valide) {
      setError(data?.message ?? "Ce code d'invitation n'est pas reconnu.");
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

    // Le groupe n'est JAMAIS de confiance côté client : handle_new_user() ignore
    // ce champ sans invitation et retombe sur `acquereur`. On ne l'envoie ici que
    // pour cohérence, la sécurité tient côté base (cf. correctif 15/07).
    const metadata: Record<string, unknown> = {
      nom_complet: nomComplet.trim(),
      telephone: telephone.trim() || null,
    };
    if (estPublic) {
      metadata.accepte_communications = accepteComm;
      // La parcelle à suivre est enregistrée dès la création du compte par
      // handle_new_user() — ainsi le suivi survit même si la confirmation d'email
      // diffère l'accès au dashboard (le paramètre ?suivi ne serait alors pas
      // rejoué). Le mécanisme ?suivi= côté dashboard reste, idempotent.
      if (suivi) metadata.suivi_reference = suivi;
    } else {
      metadata.groupe = groupe;
      metadata.code_invitation = code.trim().toUpperCase();
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    if (data.session) {
      // Session immédiate (pas de confirmation bloquante) : on file au dashboard.
      // En mode public avec une parcelle à suivre, on propage la référence — le
      // dashboard acquéreur appelle suivre_parcelle() au chargement.
      const cible =
        estPublic && suivi
          ? `/dashboard/mon-achat?suivi=${encodeURIComponent(suivi)}`
          : "/dashboard";
      router.push(cible);
      router.refresh();
      return;
    }

    setStep("success");
    setIsLoading(false);
  };

  const currentStepIndex = steps.findIndex((item) => item.key === step);

  return (
    <main className="min-h-dvh bg-[#F7F9FC] px-4 py-6 text-[#172033] antialiased sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1180px] items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="hidden rounded-2xl border border-[#D5E0E9] bg-white p-8 shadow-[0_18px_48px_-36px_rgba(11,46,79,0.35)] lg:block">
            <Link href="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5E8C]/40" aria-label="Accueil SGNF">
              <Image src="/logo-embleme.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" priority />
              <div>
                <p className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGNF</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">
                  {estPublic ? "Compte acquéreur" : "Activation sécurisée"}
                </p>
              </div>
            </Link>

            <div className="mt-16 max-w-md">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#0F5E8C]/20 bg-[#F7F9FC] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">
                {estPublic ? <Bell className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {estPublic ? "Suivi & alertes" : "Accès par invitation"}
              </p>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-[#0B2E4F]">
                {estPublic
                  ? "Suivez un terrain et soyez prévenu s'il est mis en vente."
                  : "Activez votre espace sans exposer vos dossiers."}
              </h1>
              <p className="mt-4 leading-7 text-[#526176]">
                {estPublic
                  ? "Créez votre compte acquéreur pour suivre les parcelles qui vous intéressent et recevoir une alerte dès qu'elles arrivent sur TerraCI Market."
                  : "Le code reçu confirme votre organisation, votre rôle et les droits associés avant la création du compte."}
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {(estPublic ? trustItemsPublic : trustItemsInvitation).map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-[#E3E8EF] bg-[#F7F9FC] px-4 py-3 text-sm font-semibold text-[#172033]">
                  <CheckCircle2 className="h-4 w-4 text-[#147A55]" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#D5E0E9] bg-white p-6 shadow-[0_18px_48px_-36px_rgba(11,46,79,0.35)] sm:p-8">
            <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
              <Image src="/logo-embleme.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
              <span className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGNF</span>
            </Link>

            <div className="mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">
                {step === "success" ? "Confirmation" : step === "form" ? "Identité" : "Invitation"}
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#0B2E4F]">
                {step === "code" && "Créer votre compte"}
                {step === "form" && (estPublic ? "Créer mon compte acquéreur" : "Compléter votre profil")}
                {step === "success" && "Compte créé"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#526176]">
                {step === "code" && "Saisissez le code d'invitation transmis par votre organisation."}
                {step === "form" &&
                  (estPublic ? (
                    "Email et mot de passe suffisent. Aucun paiement ni document ne vous sera demandé."
                  ) : (
                    <>
                      Votre accès sera rattaché à l&apos;espace{" "}
                      <span className="font-bold text-[#0B2E4F]">{GROUPES_LABELS[groupe] ?? groupe}</span>.
                    </>
                  ))}
                {step === "success" && (
                  <>
                    Un lien de confirmation a été envoyé à <span className="font-bold text-[#172033]">{email}</span>.
                  </>
                )}
              </p>
            </div>

            <ol className={`mb-8 grid gap-2 ${estPublic ? "grid-cols-2" : "grid-cols-3"}`} aria-label="Progression de l'inscription">
              {steps.map((item, index) => {
                const active = index === currentStepIndex;
                const done = index < currentStepIndex;
                return (
                  <li key={item.key}>
                    <div className={`h-1 rounded-full ${active || done ? "bg-[#0F5E8C]" : "bg-[#E3E8EF]"}`} />
                    <p className={`mt-2 flex items-center gap-1 text-xs font-bold ${active ? "text-[#0B2E4F]" : done ? "text-[#147A55]" : "text-[#8B98AA]"}`}>
                      {done && <Check className="h-3 w-3" />}
                      {item.label}
                    </p>
                  </li>
                );
              })}
            </ol>

            {step === "code" && (
              <form onSubmit={handleValiderCode} className="space-y-5">
                <div>
                  <label htmlFor="code" className="mb-2 block text-sm font-semibold text-[#172033]">
                    Code d&apos;invitation
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                    <Input
                      id="code"
                      type="text"
                      placeholder="SGNF-XXXXXXXX"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      className="h-12 border-[#C9D5E0] bg-white pl-10 font-mono tracking-widest"
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#526176]">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Le code est fourni par l&apos;administrateur de votre organisation.
                  </p>
                </div>

                {error && <p role="alert" className="rounded-xl border border-[#B42318]/25 bg-[#B42318]/[0.06] px-3 py-3 text-sm text-[#8E1D16]">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isLoading ? "Vérification en cours..." : "Valider le code"}
                </button>

                <p className="text-center text-sm text-[#526176]">
                  Vous êtes géomètre-expert et n&apos;avez pas de code ?{" "}
                  <Link href="/devenir-geometre" className="font-bold text-[#0F5E8C] hover:underline">
                    Faire une demande d&apos;inscription.
                  </Link>
                </p>
              </form>
            )}

            {step === "form" && (
              <form onSubmit={handleInscription} className="space-y-4">
                <div>
                  <label htmlFor="nom" className="mb-2 block text-sm font-semibold text-[#172033]">Nom complet</label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                    <Input id="nom" type="text" placeholder="Prénom NOM" value={nomComplet} onChange={(e) => setNomComplet(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="telephone" className="mb-2 block text-sm font-semibold text-[#172033]">
                    Téléphone {estPublic && <span className="font-normal text-[#8B98AA]">(facultatif)</span>}
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                    <Input id="telephone" type="tel" placeholder="+225 07 00 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#172033]">Adresse e-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                    <Input id="email" type="email" placeholder={estPublic ? "vous@email.com" : "vous@organisation.ci"} value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#172033]">Mot de passe</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 border-[#C9D5E0] pl-10 pr-12" required />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-[#526176] transition hover:bg-[#F1F5F9]" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Consentement communications — non pré-coché, séparé de la création
                    du compte (loi 2013-450 / ARTCI). Grand public uniquement. */}
                {estPublic && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#E3E8EF] bg-[#F7F9FC] px-4 py-3 text-sm text-[#526176]">
                    <input
                      type="checkbox"
                      checked={accepteComm}
                      onChange={(e) => setAccepteComm(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C9D5E0] text-[#0B2E4F] focus:ring-[#0F5E8C]"
                    />
                    <span>
                      J&apos;accepte de recevoir des informations de SGNF (nouvelles annonces,
                      terrains suivis). Vous pourrez vous désinscrire à tout moment.
                    </span>
                  </label>
                )}

                {error && <p role="alert" className="rounded-xl border border-[#B42318]/25 bg-[#B42318]/[0.06] px-3 py-3 text-sm text-[#8E1D16]">{error}</p>}

                {estPublic && (
                  <p className="flex items-start gap-2 rounded-xl bg-[#0F5E8C]/[0.05] px-3 py-2.5 text-xs leading-relaxed text-[#526176]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#147A55]" />
                    SGNF ne vous demandera jamais d&apos;argent ni vos papiers pour créer ce compte —
                    seulement un email et un mot de passe.
                  </p>
                )}

                <div className="grid gap-3 pt-1 sm:grid-cols-[auto_1fr]">
                  <Link
                    href={estPublic ? "/" : "#"}
                    onClick={(e) => {
                      if (!estPublic) {
                        e.preventDefault();
                        setStep("code");
                        setError("");
                      }
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#C9D5E0] bg-white px-4 text-sm font-bold text-[#0B2E4F] transition hover:bg-[#F7F9FC]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </Link>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isLoading ? "Création en cours..." : "Créer mon compte"}
                  </button>
                </div>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#147A55]/10 text-[#147A55]">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <Link href="/login" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C]">
                  Aller à la connexion
                </Link>
              </div>
            )}

            {step !== "success" && (
              <p className="mt-8 text-center">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#526176] transition-colors hover:text-[#0F5E8C]">
                  <ArrowLeft className="h-4 w-4" />
                  Retour à l&apos;accueil
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// useSearchParams impose une borne Suspense sur un export statique (output: export).
export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionInner />
    </Suspense>
  );
}
