"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell, CircleHelp, FileText, Headphones, KeyRound, Mail, Phone, Save, ShieldCheck, UserRound,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { Input } from "@/components/ds/input";
import { Field } from "@/components/ds/label";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";
import { fadeUp, stagger } from "@/lib/motion";

const roleLabels: Record<string, string> = {
  admin: "Administrateur", operateur: "Opérateur", proprietaire: "Propriétaire", acquereur: "Acquéreur", amenageur: "Aménageur", commissaire: "Commissaire", verificateur: "Vérificateur", chefferie: "Chefferie", geometre: "Géomètre", agent_ia: "Agent IA", proprietaire_terrien: "Propriétaire terrien", operateur_saisie: "Opérateur de saisie",
};

type Feedback = { type: "ok" | "error"; message: string } | null;

export default function ProfilPage() {
  const { profile, loading } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();
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

  return (
    <AppShell loading={loading} counts={counts} onRefresh={() => {}}>
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Compte</p>
        <h1 className="mt-1 font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Profil et sécurité
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Mettez à jour vos coordonnées et votre mot de passe.
        </p>
      </div>

      <motion.div
        variants={stagger(0.05, 0.06)}
        initial="hidden"
        animate="show"
        className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start"
      >
        <div className="flex min-w-0 flex-col gap-5">
          {/* Identité (lecture seule) */}
          <motion.div variants={fadeUp}>
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-inset text-primary">
                  <UserRound className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {loading ? "Chargement…" : profile?.nom_complet || "Utilisateur SGNF"}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">{role}</p>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-border border-y border-border">
                <div className="flex justify-between gap-4 py-3.5">
                  <dt className="text-[13px] text-muted-foreground">Rôle et droits</dt>
                  <dd className="text-right text-[13px] font-bold text-foreground">{role}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3.5">
                  <dt className="text-[13px] text-muted-foreground">Statut du compte</dt>
                  <dd className="inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
                    <span className="size-2 rounded-full bg-success" aria-hidden />
                    {profile?.actif ? "Actif" : "À confirmer"}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 flex gap-2 text-[13px] leading-6 text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                Votre rôle et vos rattachements sont gérés par l&apos;administration SGNF et ne sont pas
                modifiables ici.
              </p>
            </Card>
          </motion.div>

          {/* Coordonnées (éditable) */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="size-4 text-accent" aria-hidden />
                    Coordonnées
                  </CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-4 px-5 pb-5">
                <Field label="Nom complet" htmlFor="nom">
                  <Input id="nom" type="text" value={nom} placeholder="Prénom NOM"
                    onChange={(e) => setNom(e.target.value)} disabled={loading || savingInfos} />
                </Field>
                <Field label="Téléphone" htmlFor="telephone">
                  <Input id="telephone" type="tel" value={telephone} placeholder="Ex. 0700000000"
                    onChange={(e) => setTelephone(e.target.value)} disabled={loading || savingInfos} />
                </Field>
                {infosFeedback && (
                  <p role="alert" className={`text-[13px] font-medium ${infosFeedback.type === "ok" ? "text-success" : "text-danger"}`}>
                    {infosFeedback.message}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    loading={savingInfos}
                    disabled={loading || !infosModifie}
                    onClick={enregistrerInfos}
                  >
                    <Save />
                    Enregistrer
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Mot de passe (éditable) */}
          <motion.div variants={fadeUp}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <KeyRound className="size-4 text-accent" aria-hidden />
                    Mot de passe
                  </CardTitle>
                  <CardDescription>
                    Au moins 8 caractères. Vous resterez connecté après le changement.
                  </CardDescription>
                </div>
              </CardHeader>
              <div className="space-y-4 px-5 pb-5">
                <Field label="Nouveau mot de passe" htmlFor="pwd">
                  <Input id="pwd" type="password" autoComplete="new-password" value={pwd}
                    placeholder="••••••••" onChange={(e) => setPwd(e.target.value)} disabled={savingPwd} />
                </Field>
                <Field label="Confirmer le mot de passe" htmlFor="pwdConfirm">
                  <Input id="pwdConfirm" type="password" autoComplete="new-password" value={pwdConfirm}
                    placeholder="••••••••" onChange={(e) => setPwdConfirm(e.target.value)} disabled={savingPwd} />
                </Field>
                {pwdFeedback && (
                  <p role="alert" className={`text-[13px] font-medium ${pwdFeedback.type === "ok" ? "text-success" : "text-danger"}`}>
                    {pwdFeedback.message}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    loading={savingPwd}
                    disabled={!pwd || !pwdConfirm}
                    onClick={changerMotDePasse}
                  >
                    <KeyRound />
                    Mettre à jour le mot de passe
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Support */}
        <aside className="flex min-w-0 flex-col gap-4">
          <motion.div variants={fadeUp}>
            <Card className="p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-inset text-accent">
                <Headphones className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold text-foreground">Besoin d&apos;aide ?</h2>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                Expliquez votre demande ; indiquez le dossier ou la référence concernée pour accélérer
                son traitement.
              </p>
              <Button asChild variant="primary" className="mt-5 w-full">
                <Link href="/contact">
                  <Mail />
                  Contacter le support
                </Link>
              </Button>
            </Card>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Card className="p-6">
              <h2 className="flex items-center gap-2 font-display font-bold text-foreground">
                <CircleHelp className="size-4 text-accent" aria-hidden />
                Ressources utiles
              </h2>
              <div className="mt-4 flex flex-col gap-1">
                <Link
                  href="/mode-emploi-saisie"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-inset"
                >
                  <FileText className="size-4" aria-hidden /> Guide de saisie
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-semibold text-accent transition-colors hover:bg-inset"
                >
                  <Bell className="size-4" aria-hidden /> Messages et demandes
                </Link>
              </div>
            </Card>
          </motion.div>
        </aside>
      </motion.div>
    </AppShell>
  );
}
