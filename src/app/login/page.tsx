"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

type Mode = "login" | "reset";

export default function LoginPage() {
  const router = useRouter();
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
    <main className="grid min-h-screen bg-[#F7F9FC] lg:grid-cols-[minmax(0,1fr)_520px]">
      <section className="hidden border-r border-[#E3E8EF] bg-[#0B2E4F] p-12 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3 text-white"><Image src="/logo-embleme.png" alt="Logo SGNF" width={48} height={48} className="h-12 w-12" priority /><span className="font-display text-2xl font-extrabold tracking-tight">SGNF</span></Link>
        <div className="max-w-md"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[#9BC8E0]">Espace sécurisé</p><h1 className="mt-4 text-4xl font-extrabold leading-tight text-white">Vos opérations foncières, dans un environnement clair.</h1><p className="mt-5 leading-7 text-slate-300">Accédez à votre espace selon votre rôle, suivez les dossiers et retrouvez les actions qui vous concernent.</p></div>
        <p className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="h-4 w-4 text-[#8FD7BB]" /> Utilisez les accès fournis par votre organisation.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-[#E3E8EF] bg-white p-6 sm:p-8">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden"><Image src="/logo-embleme.png" alt="Logo SGNF" width={42} height={42} className="h-10 w-10" priority /><span className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGNF</span></Link>
          <div><p className="text-sm font-bold uppercase tracking-[0.15em] text-[#0F5E8C]">{mode === "login" ? "Connexion" : "Réinitialisation"}</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0B2E4F]">{mode === "login" ? "Accéder à votre espace" : "Retrouver votre accès"}</h2><p className="mt-3 text-sm leading-6 text-[#526176]">{mode === "login" ? "Saisissez les identifiants associés à votre invitation." : "Indiquez votre adresse e-mail : nous vous enverrons les instructions si un compte existe."}</p></div>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#172033]">Adresse e-mail</label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@organisation.ci" className="h-12 border-[#C9D5E0] bg-white pl-10 font-normal" required /></div></div>
            {mode === "login" && <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold text-[#172033]">Mot de passe</label><button type="button" onClick={() => { setMode("reset"); setError(null); }} className="text-sm font-semibold text-[#0F5E8C] hover:underline">Mot de passe oublié ?</button></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" className="h-12 border-[#C9D5E0] bg-white pl-10 pr-12 font-normal" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>}
            {error && <p role="alert" className="rounded-xl border border-[#B42318]/25 bg-[#B42318]/[0.06] px-3 py-3 text-sm leading-5 text-[#8E1D16]">{error}</p>}
            {message && <p role="status" className="rounded-xl border border-[#147A55]/25 bg-[#147A55]/[0.06] px-3 py-3 text-sm leading-5 text-[#126443]">{message}</p>}
            <button type="submit" disabled={isLoading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:cursor-not-allowed disabled:opacity-55">{isLoading ? "Traitement en cours…" : mode === "login" ? "Se connecter" : "Recevoir le lien"}{mode === "reset" && !isLoading && <KeyRound className="h-4 w-4" />}</button>
          </form>

          <div className="mt-6 border-t border-[#E3E8EF] pt-5 text-center text-sm text-[#526176]">{mode === "login" ? <p>Vous avez reçu une invitation ? <Link href="/inscription" className="font-bold text-[#0F5E8C] hover:underline">Activer mon compte</Link></p> : <button type="button" onClick={() => { setMode("login"); setError(null); setMessage(null); }} className="font-bold text-[#0F5E8C] hover:underline">Retour à la connexion</button>}</div>
          <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-[#526176]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#147A55]" /> Ne partagez jamais vos identifiants. En cas de doute, contactez l’administrateur de votre organisation.</p>
        </div>
      </section>
    </main>
  );
}
