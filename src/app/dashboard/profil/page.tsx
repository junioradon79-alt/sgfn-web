"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CircleHelp,
  FileText,
  Headphones,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";

const roleLabels: Record<string, string> = {
  admin: "Administrateur", operateur: "Opérateur", proprietaire: "Propriétaire", acquereur: "Acquéreur", amenageur: "Aménageur", commissaire: "Commissaire", verificateur: "Vérificateur", chefferie: "Chefferie", geometre: "Géomètre", agent_ia: "Agent IA", proprietaire_terrien: "Propriétaire terrien", operateur_saisie: "Opérateur de saisie",
};

type Feedback = { type: "ok" | "error"; message: string } | null;

export default function ProfilPage() {
  const { profile, loading } = useProfile();
  const supabase = createClient();
  const role = profile?.groupe ? roleLabels[profile.groupe] ?? profile.groupe : "—";

  // ── Coordonnées (nom_complet, telephone) ────────────────────────────────────
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [seededId, setSeededId] = useState<string | null>(null);
  const [savingInfos, setSavingInfos] = useState(false);
  const [infosFeedback, setInfosFeedback] = useState<Feedback>(null);

  // Semer les champs éditables une fois le profil chargé — pattern React
  // « ajuster l'état pendant le rendu » (react.dev), plus sûr qu'un setState
  // dans un effet et sans re-render en cascade.
  if (profile && profile.id !== seededId) {
    setSeededId(profile.id);
    setNom(profile.nom_complet ?? "");
    setTelephone(profile.telephone ?? "");
  }

  const infosModifie =
    !!profile && (nom.trim() !== (profile.nom_complet ?? "") || telephone.trim() !== (profile.telephone ?? ""));

  const enregistrerInfos = async () => {
    if (!profile) return;
    if (!nom.trim()) {
      setInfosFeedback({ type: "error", message: "Le nom complet est obligatoire." });
      return;
    }
    setSavingInfos(true);
    setInfosFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .update({ nom_complet: nom.trim(), telephone: telephone.trim() || null })
      .eq("id", profile.id);
    setSavingInfos(false);
    setInfosFeedback(
      error
        ? { type: "error", message: error.message }
        : { type: "ok", message: "Coordonnées mises à jour." },
    );
  };

  // ── Mot de passe ────────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState<Feedback>(null);

  const changerMotDePasse = async () => {
    if (pwd.length < 8) {
      setPwdFeedback({ type: "error", message: "Le mot de passe doit faire au moins 8 caractères." });
      return;
    }
    if (pwd !== pwdConfirm) {
      setPwdFeedback({ type: "error", message: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setSavingPwd(true);
    setPwdFeedback(null);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) {
      setPwdFeedback({ type: "error", message: error.message });
      return;
    }
    setPwd("");
    setPwdConfirm("");
    setPwdFeedback({ type: "ok", message: "Mot de passe mis à jour." });
  };

  const inputClass =
    "w-full rounded-xl border border-[#E3E8EF] bg-white px-3.5 py-2.5 text-sm text-[#172033] shadow-sm placeholder:text-slate-400 focus:border-[#0F5E8C] focus:outline-none focus:ring-2 focus:ring-[#0F5E8C]/10";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#526176]";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#0F5E8C]">Compte</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0B2E4F]">Profil et sécurité</h1>
        <p className="mt-2 text-[#526176]">Mettez à jour vos coordonnées et votre mot de passe.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {/* Identité (lecture seule) */}
          <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B2E4F]/[0.06] text-[#0B2E4F]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0B2E4F]">{loading ? "Chargement…" : profile?.nom_complet || "Utilisateur SGNF"}</h2>
                <p className="text-sm text-[#526176]">{role}</p>
              </div>
            </div>
            <dl className="mt-7 divide-y divide-[#E3E8EF] border-y border-[#E3E8EF]">
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[#526176]">Rôle et droits</dt>
                <dd className="text-right text-sm font-bold text-[#172033]">{role}</dd>
              </div>
              <div className="flex justify-between gap-4 py-4">
                <dt className="text-sm text-[#526176]">Statut du compte</dt>
                <dd className="inline-flex items-center gap-1.5 text-sm font-bold text-[#147A55]">
                  <span className="h-2 w-2 rounded-full bg-[#147A55]" />
                  {profile?.actif ? "Actif" : "À confirmer"}
                </dd>
              </div>
            </dl>
            <p className="mt-5 flex gap-2 text-sm leading-6 text-[#526176]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#147A55]" /> Votre rôle et vos rattachements sont
              gérés par l&apos;administration SGNF et ne sont pas modifiables ici.
            </p>
          </section>

          {/* Coordonnées (éditable) */}
          <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0B2E4F]">
              <Phone className="h-5 w-5 text-[#0F5E8C]" /> Coordonnées
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="nom" className={labelClass}>Nom complet</label>
                <input id="nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} placeholder="Prénom NOM" disabled={loading || savingInfos} />
              </div>
              <div>
                <label htmlFor="telephone" className={labelClass}>Téléphone</label>
                <input id="telephone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} placeholder="Ex. 0700000000" disabled={loading || savingInfos} />
              </div>
              {infosFeedback && (
                <p className={`text-sm ${infosFeedback.type === "ok" ? "text-[#147A55]" : "text-red-600"}`}>{infosFeedback.message}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={enregistrerInfos}
                  disabled={loading || savingInfos || !infosModifie}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:opacity-50"
                >
                  {savingInfos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </section>

          {/* Mot de passe (éditable) */}
          <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0B2E4F]">
              <KeyRound className="h-5 w-5 text-[#0F5E8C]" /> Mot de passe
            </h2>
            <p className="mt-2 text-sm text-[#526176]">Au moins 8 caractères. Vous resterez connecté après le changement.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="pwd" className={labelClass}>Nouveau mot de passe</label>
                <input id="pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={inputClass} placeholder="••••••••" disabled={savingPwd} />
              </div>
              <div>
                <label htmlFor="pwdConfirm" className={labelClass}>Confirmer le mot de passe</label>
                <input id="pwdConfirm" type="password" autoComplete="new-password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} className={inputClass} placeholder="••••••••" disabled={savingPwd} />
              </div>
              {pwdFeedback && (
                <p className={`text-sm ${pwdFeedback.type === "ok" ? "text-[#147A55]" : "text-red-600"}`}>{pwdFeedback.message}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={changerMotDePasse}
                  disabled={savingPwd || !pwd || !pwdConfirm}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2E4F] px-5 text-sm font-bold text-white transition hover:bg-[#0F5E8C] disabled:opacity-50"
                >
                  {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Mettre à jour le mot de passe
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Support */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B2E4F]/[0.06] text-[#0F5E8C]"><Headphones className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-bold text-[#0B2E4F]">Besoin d&apos;aide ?</h2>
            <p className="mt-2 text-sm leading-6 text-[#526176]">Expliquez votre demande ; indiquez le dossier ou la référence concernée pour accélérer son traitement.</p>
            <Link href="/contact" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2E4F] text-sm font-bold text-white transition hover:bg-[#0F5E8C]"><Mail className="h-4 w-4" /> Contacter le support</Link>
          </section>
          <section className="rounded-2xl border border-[#E3E8EF] bg-white p-6">
            <h2 className="flex items-center gap-2 font-bold text-[#0B2E4F]"><CircleHelp className="h-5 w-5 text-[#0F5E8C]" /> Ressources utiles</h2>
            <div className="mt-4 space-y-2">
              <Link href="/mode-emploi-saisie" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#0F5E8C] hover:bg-slate-50"><FileText className="h-4 w-4" /> Guide de saisie</Link>
              <Link href="/dashboard/messages" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#0F5E8C] hover:bg-slate-50"><Bell className="h-4 w-4" /> Messages et demandes</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
