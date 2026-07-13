"use client";

import Link from "next/link";
import { Bell, CircleHelp, FileText, Headphones, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

const roleLabels: Record<string, string> = {
  admin: "Administrateur", operateur: "Opérateur", proprietaire: "Propriétaire", acquereur: "Acquéreur", amenageur: "Aménageur", commissaire: "Commissaire", verificateur: "Vérificateur", chefferie: "Chefferie", geometre: "Géomètre", agent_ia: "Agent IA", proprietaire_terrien: "Propriétaire terrien", operateur_saisie: "Opérateur de saisie",
};

export default function ProfilPage() {
  const { profile, loading } = useProfile();
  const role = profile?.groupe ? roleLabels[profile.groupe] ?? profile.groupe : "—";

  return <div className="mx-auto max-w-5xl">
    <div className="mb-8"><p className="text-sm font-bold uppercase tracking-[0.15em] text-[#0F5E8C]">Compte</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0B2E4F]">Profil et support</h1><p className="mt-2 text-[#526176]">Consultez vos droits et retrouvez l’aide utile à votre espace.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B2E4F]/[0.06] text-[#0B2E4F]"><UserRound className="h-6 w-6" /></div><div><h2 className="text-lg font-bold text-[#0B2E4F]">{loading ? "Chargement…" : profile?.nom_complet || "Utilisateur SGFN"}</h2><p className="text-sm text-[#526176]">{role}</p></div></div><dl className="mt-7 divide-y divide-[#E3E8EF] border-y border-[#E3E8EF]"><div className="flex justify-between gap-4 py-4"><dt className="text-sm text-[#526176]">Rôle et droits</dt><dd className="text-right text-sm font-bold text-[#172033]">{role}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-sm text-[#526176]">Téléphone</dt><dd className="text-right text-sm font-bold text-[#172033]">{profile?.telephone ?? "Non renseigné"}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-sm text-[#526176]">Statut du compte</dt><dd className="inline-flex items-center gap-1.5 text-sm font-bold text-[#147A55]"><span className="h-2 w-2 rounded-full bg-[#147A55]" />{profile?.actif ? "Actif" : "À confirmer"}</dd></div></dl><p className="mt-5 flex gap-2 text-sm leading-6 text-[#526176]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#147A55]" /> Vos droits sont appliqués selon le rôle attribué par votre organisation.</p></section>
      <aside className="space-y-4"><section className="rounded-2xl border border-[#E3E8EF] bg-white p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2E4F]/[0.06] text-[#0F5E8C]"><Headphones className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-bold text-[#0B2E4F]">Besoin d’aide ?</h2><p className="mt-2 text-sm leading-6 text-[#526176]">Expliquez votre demande ; indiquez le dossier ou la référence concernée pour accélérer son traitement.</p><Link href="/contact" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] text-sm font-bold text-white transition hover:bg-[#0F5E8C]"><Mail className="h-4 w-4" /> Contacter le support</Link></section><section className="rounded-2xl border border-[#E3E8EF] bg-white p-6"><h2 className="flex items-center gap-2 font-bold text-[#0B2E4F]"><CircleHelp className="h-5 w-5 text-[#0F5E8C]" /> Ressources utiles</h2><div className="mt-4 space-y-2"><Link href="/mode-emploi-saisie" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#0F5E8C] hover:bg-slate-50"><FileText className="h-4 w-4" /> Guide de saisie</Link><Link href="/dashboard/messages" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#0F5E8C] hover:bg-slate-50"><Bell className="h-4 w-4" /> Messages et demandes</Link></div></section></aside>
    </div>
  </div>;
}
