"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { metiers } from "../metiers-partenaires/page";

type FormState = "idle" | "sending" | "success" | "error";

function ContactForm() {
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<FormState>("idle");

  const profil = searchParams.get("profil");
  const metier = useMemo(() => metiers.find((m) => m.slug === profil) ?? null, [profil]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState("sending");

    const form = e.currentTarget;
    const data = {
      nom: (form.elements.namedItem("nom") as HTMLInputElement).value,
      institution: (form.elements.namedItem("institution") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      telephone: (form.elements.namedItem("telephone") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      await fetch("https://formsubmit.co/ajax/contact@sgfn.ci", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      setFormState("success");
      form.reset();
    } catch {
      setFormState("error");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900 antialiased">
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <Link
          href="/"
          className="mb-8 text-sm font-semibold text-[#1E6091] transition hover:text-[#0D3B66]"
        >
          ← Retour à l&apos;accueil
        </Link>

        <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(13,59,102,0.08)] sm:p-10 lg:p-12">
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
              Contact
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-[#0D3B66] sm:text-4xl">
              Contactez SGFN
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
              {metier
                ? `Vous êtes ${metier.nom.toLowerCase()} ? Décrivez votre besoin, notre équipe revient vers vous rapidement.`
                : "Une question sur la plateforme, un besoin d'assistance technique ou une demande de démonstration administrative ?"}
            </p>
          </div>

          {formState === "success" ? (
            <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-emerald-50 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-emerald-800">Message envoyé !</p>
              <p className="text-sm text-emerald-700">Nous reviendrons vers vous dans les plus brefs délais.</p>
              <button
                onClick={() => setFormState("idle")}
                className="mt-2 text-sm font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-900"
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto mt-10 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="nom"
                  type="text"
                  placeholder="Nom complet"
                  required
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10"
                />
                <input
                  name="institution"
                  type="text"
                  placeholder="Institution / Qualité"
                  defaultValue={metier?.nom ?? ""}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  name="email"
                  type="email"
                  placeholder="E-mail"
                  required
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10"
                />
                <input
                  name="telephone"
                  type="tel"
                  placeholder="Téléphone"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10"
                />
              </div>
              <textarea
                name="message"
                rows={6}
                placeholder="Votre message…"
                defaultValue={metier ? `Bonjour, je suis intéressé(e) par SGFN en tant que ${metier.nom.toLowerCase()}. ` : ""}
                required
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D3B66] focus:ring-2 focus:ring-[#0D3B66]/10"
              />

              {formState === "error" && (
                <p className="text-sm font-medium text-red-600">
                  Une erreur s&apos;est produite. Veuillez réessayer.
                </p>
              )}

              <button
                type="submit"
                disabled={formState === "sending"}
                className="w-full rounded-2xl bg-[#0D3B66] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-70"
              >
                {formState === "sending" ? "Envoi en cours…" : "Envoyer la demande officielle"}
              </button>
            </form>
          )}

          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            <p className="font-semibold text-[#0D3B66]">SGFN Secrétariat</p>
            <p>Abidjan, Côte d&apos;Ivoire</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}
