"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import SGFNButton from "@/components/ui/SGFNButton";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setPassword("");
      setErrorMessage("Identifiants invalides. Vérifiez votre adresse e-mail et votre mot de passe.");
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-10 font-sans antialiased">
      <div className="grid w-full max-w-3xl items-start gap-6 lg:grid-cols-[300px_1fr]">
        {/* Panneau invitation — nouveaux utilisateurs avec un code */}
        <aside className="rounded-2xl border border-slate-200/40 bg-white p-6 shadow-sm lg:sticky lg:top-10">
          <h2 className="text-base font-bold text-[#0D3B66]">
            Nouveau sur SGNF ?
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Vous avez reçu un code d&apos;invitation par SMS ou e-mail ? Créez
            votre compte pour l&apos;activer.
          </p>
          <Link
            href="/inscription"
            className="mt-4 flex h-11 items-center justify-center rounded-xl border-2 border-[#0D3B66] px-4 text-sm font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66] hover:text-white active:scale-[0.98]"
          >
            J&apos;ai un code d&apos;invitation
          </Link>
        </aside>

        {/* Carte de connexion */}
        <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200/40 bg-white p-6 shadow-sm sm:p-8 lg:mx-0">
          {/* En-tête */}
          <div className="mb-7 sm:mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-[#0D3B66] p-[2px] shadow-sm">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-white">
                  <Image
                    src="/logo-embleme.png"
                    alt="SGNF"
                    width={48}
                    height={48}
                    className="h-11 w-11 sm:h-12 sm:w-12 object-contain"
                    priority
                  />
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#0D3B66] uppercase">
                SGNF
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#0D3B66]">
              Accéder à SGNF
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Entrez vos identifiants pour piloter votre espace foncier.
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMessage && (
              <p className="text-sm font-medium text-red-600">{errorMessage}</p>
            )}

            <SGFNButton
              type="submit"
              size="lg"
              disabled={isLoading}
              className="mt-2 w-full rounded-xl bg-[#0D3B66] text-white shadow-sm transition-all hover:bg-[#1E6091] active:scale-[0.98] active:bg-[#0D3B66]"
            >
              {isLoading ? "Connexion en cours..." : "Se connecter"}
            </SGFNButton>
          </form>

          <p className="mt-7 sm:mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-slate-400 transition-colors hover:text-[#1E6091]"
            >
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
