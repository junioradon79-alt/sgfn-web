"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ds/button";
import { Input } from "@/components/ds/input";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type Mode = "login" | "reset";

/**
 * Connexion — alignée sur le Design System (20/07).
 *
 * L'écran ne figure dans aucune des huit maquettes du handoff : son apparence
 * est donc *dérivée* des jetons, pas recopiée. Deux règles s'appliquent —
 *   - aucune couleur en dur : l'écran suivait encore l'ancien bleu `#0B2E4F`,
 *     alors que le principal est `#0B4D88` depuis la refonte ;
 *   - le thème est repris du choix de l'utilisateur (`useTheme`), scopé sur la
 *     racine de l'écran comme dans le reste de la plateforme.
 *
 * Le panneau de gauche reste sur `--primary` dans les deux thèmes : c'est une
 * surface de marque, pas une surface de contenu. Les libellés qu'il porte sont
 * donc exprimés en blanc translucide, qui tient sur ce fond quel que soit le
 * thème, plutôt qu'en jetons de texte qui basculeraient avec lui.
 *
 * ⚠️ Les `id` `#email` et `#password` servent aux scripts de vérification
 * (`scripts/e2e-shot.mjs`) : ne pas les renommer.
 */
export default function LoginPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    const supabase = createClient();

    if (mode === "reset") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      setIsLoading(false);
      if (resetError) setError("Le lien de réinitialisation n’a pas pu être envoyé. Réessayez ou contactez le support.");
      else setMessage("Si cette adresse est associée à un compte, un lien de réinitialisation vient d’être envoyé.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (loginError) {
      setPassword("");
      setError("Adresse e-mail ou mot de passe incorrect. Vérifiez vos informations puis réessayez.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className={cn(isDark && "dark")}>
      <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="hidden border-r border-border bg-primary p-12 lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3 text-white" aria-label="Accueil SGNF">
            <Image src="/logo-embleme.png" alt="" width={48} height={48} className="h-12 w-12" priority />
            <span className="font-display text-2xl font-extrabold tracking-tight">SGNF</span>
          </Link>

          <div className="max-w-md">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/70">Espace sécurisé</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white">
              Vos opérations foncières, dans un environnement clair.
            </h1>
            <p className="mt-5 leading-7 text-white/75">
              Accédez à votre espace selon votre rôle, suivez les dossiers et retrouvez les actions qui vous concernent.
            </p>
          </div>

          <p className="flex items-center gap-2 text-sm text-white/75">
            <ShieldCheck className="size-4 shrink-0" aria-hidden /> Utilisez les accès fournis par votre organisation.
          </p>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-panel sm:p-8">
            <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden" aria-label="Accueil SGNF">
              <Image src="/logo-embleme.png" alt="" width={42} height={42} className="h-10 w-10" priority />
              <span className="font-display text-xl font-extrabold tracking-tight text-foreground">SGNF</span>
            </Link>

            <div>
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-accent">
                {mode === "login" ? "Connexion" : "Réinitialisation"}
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                {mode === "login" ? "Accéder à votre espace" : "Retrouver votre accès"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {mode === "login"
                  ? "Saisissez les identifiants associés à votre invitation."
                  : "Indiquez votre adresse e-mail : nous vous enverrons les instructions si un compte existe."}
              </p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-foreground">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-2"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vous@organisation.ci"
                    className="h-12 pl-10"
                    required
                  />
                </div>
              </div>

              {mode === "login" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-semibold text-foreground">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                      }}
                      className="rounded text-sm font-semibold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-2"
                      aria-hidden
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Votre mot de passe"
                      className="h-12 pl-10 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-inset hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger-subtle px-3 py-3 text-sm leading-5 text-danger"
                >
                  {error}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="rounded-xl border border-success/25 bg-success-subtle px-3 py-3 text-sm leading-5 text-success"
                >
                  {message}
                </p>
              )}

              <Button type="submit" variant="primary" loading={isLoading} className="h-12 w-full rounded-xl font-bold">
                {isLoading ? "Traitement en cours…" : mode === "login" ? "Se connecter" : "Recevoir le lien"}
                {mode === "reset" && !isLoading && <KeyRound className="size-4" />}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <p>
                  Vous avez reçu une invitation ?{" "}
                  <Link href="/inscription" className="font-bold text-accent hover:underline">
                    Activer mon compte
                  </Link>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className="rounded font-bold text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Retour à la connexion
                </button>
              )}
            </div>

            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Ne partagez jamais vos
              identifiants. En cas de doute, contactez l’administrateur de votre organisation.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
