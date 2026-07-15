"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  IdCard,
  Mail,
  MessageSquare,
  Phone,
  Ruler,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";

const trustItems = [
  "Demande examinée par l'administration SGFN",
  "Fiche registre créée après validation",
  "Code d'activation transmis une fois approuvée",
];

export default function DevenirGeometrePage() {
  const supabase = createClient();

  const [nom, setNom] = useState("");
  const [numeroOrdre, setNumeroOrdre] = useState("");
  const [cabinet, setCabinet] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [envoyee, setEnvoyee] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error: rpcError } = await supabase.rpc("demander_inscription_geometre", {
      p_nom: nom.trim(),
      p_numero_ordre: numeroOrdre.trim() || undefined,
      p_cabinet: cabinet.trim() || undefined,
      p_telephone: telephone.trim(),
      p_email: email.trim() || undefined,
      p_message: message.trim() || undefined,
    });

    setIsLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setEnvoyee(true);
  };

  return (
    <main className="min-h-dvh bg-[#F7F9FC] px-4 py-6 text-[#172033] antialiased sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[1180px] items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section className="hidden rounded-2xl border border-[#D5E0E9] bg-white p-8 shadow-[0_18px_48px_-36px_rgba(11,46,79,0.35)] lg:block">
            <Link href="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5E8C]/40" aria-label="Accueil SGFN">
              <Image src="/logo-embleme.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" priority />
              <div>
                <p className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGFN</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Réseau partenaires</p>
              </div>
            </Link>

            <div className="mt-16 max-w-md">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#0F5E8C]/20 bg-[#F7F9FC] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">
                <Ruler className="h-4 w-4" />
                Géomètres-experts
              </p>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-[#0B2E4F]">
                Pilotez votre activité de géomètre-expert depuis SGFN.
              </h1>
              <p className="mt-4 leading-7 text-[#526176]">
                Registre officiel, portefeuille de missions, PV de bornage QR-vérifiables. Transmettez vos informations,
                l&apos;administration valide votre fiche et vous envoie un code d&apos;activation.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {trustItems.map((item) => (
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
              <span className="font-display text-xl font-extrabold tracking-tight text-[#0B2E4F]">SGFN</span>
            </Link>

            {!envoyee ? (
              <>
                <div className="mb-8">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Demande d&apos;inscription</p>
                  <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#0B2E4F]">
                    Devenir géomètre-expert partenaire
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#526176]">
                    Vous avez déjà un code d&apos;invitation ?{" "}
                    <Link href="/inscription" className="font-bold text-[#0F5E8C] hover:underline">
                      Créez votre compte directement.
                    </Link>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="nom" className="mb-2 block text-sm font-semibold text-[#172033]">Nom complet</label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                      <Input id="nom" type="text" placeholder="Prénom NOM, Géomètre-Expert" value={nom} onChange={(e) => setNom(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="numero-ordre" className="mb-2 block text-sm font-semibold text-[#172033]">Numéro d&apos;ordre</label>
                      <div className="relative">
                        <IdCard className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                        <Input id="numero-ordre" type="text" placeholder="OGEF-CI-0042" value={numeroOrdre} onChange={(e) => setNumeroOrdre(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cabinet" className="mb-2 block text-sm font-semibold text-[#172033]">Cabinet</label>
                      <div className="relative">
                        <Briefcase className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                        <Input id="cabinet" type="text" placeholder="Cabinet & Associés" value={cabinet} onChange={(e) => setCabinet(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="telephone" className="mb-2 block text-sm font-semibold text-[#172033]">Téléphone</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                      <Input id="telephone" type="tel" placeholder="+225 07 00 00 00 00" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" required />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#172033]">Adresse e-mail (optionnel)</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#8B98AA]" />
                      <Input id="email" type="email" placeholder="vous@cabinet.ci" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 border-[#C9D5E0] pl-10" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="mb-2 block text-sm font-semibold text-[#172033]">Message (optionnel)</label>
                    <div className="relative">
                      <MessageSquare className="pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 text-[#8B98AA]" />
                      <textarea
                        id="message"
                        rows={3}
                        placeholder="Précisez votre zone d'intervention, vos besoins…"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full rounded-xl border border-[#C9D5E0] bg-white py-2.5 pl-10 pr-3 text-sm text-[#172033] shadow-sm focus:border-[#0F5E8C] focus:outline-none focus:ring-2 focus:ring-[#0F5E8C]/10"
                      />
                    </div>
                  </div>

                  {error && <p role="alert" className="rounded-xl border border-[#B42318]/25 bg-[#B42318]/[0.06] px-3 py-3 text-sm text-[#8E1D16]">{error}</p>}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isLoading ? "Envoi en cours..." : "Transmettre ma demande"}
                  </button>
                </form>
              </>
            ) : (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#147A55]/10 text-[#147A55]">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#0B2E4F]">Demande transmise</h2>
                  <p className="mt-3 text-sm leading-6 text-[#526176]">
                    L&apos;administration SGFN va examiner votre demande. Une fois validée, un code d&apos;activation vous
                    sera transmis pour créer votre compte.
                  </p>
                </div>
                <Link href="/" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C]">
                  Retour à l&apos;accueil
                </Link>
              </div>
            )}

            {!envoyee && (
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
