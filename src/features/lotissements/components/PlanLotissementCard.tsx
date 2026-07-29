"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Map as MapIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import {
  apercuPossible,
  deposerPlanLotissement,
  extensionDe,
  getPlansLotissement,
  supprimerPlanLotissement,
  tailleLisible,
  telechargerPlan,
  urlSigneePlan,
  type DocumentLotissement,
} from "../services/plans.service";

/**
 * Plan de morcellement et pièces de référence d'un lotissement.
 *
 * ── LA RÈGLE DE CET ÉCRAN ───────────────────────────────────────────────────
 * Il n'y a **aucune liste d'extensions autorisées**, et il ne doit jamais y en
 * avoir : le champ de fichier est sans `accept`, rien n'est refusé sur le
 * format. C'est la demande explicite du 29/07 — « conserver toutes les
 * extensions pour la lecture des fichiers de ce type ». Le plan de Brignan
 * Kakodji arrive en PDF scanné, mais le même périmètre existe aussi en DWG chez
 * le géomètre, en KMZ dans un GPS et en SHP dans un SIG ; les quatre doivent
 * pouvoir entrer.
 *
 * Ce que le navigateur sait montrer (PDF, images) est montré ; tout le reste
 * est **téléchargé sous son nom d'origine**. « Je ne sais pas l'afficher » et
 * « je ne l'accepte pas » sont deux choses différentes, et l'écran ne confond
 * pas les deux : un DWG affiche « Aperçu indisponible dans le navigateur », pas
 * une erreur.
 */

type Props = {
  lotissementId: string;
  /** Le dépôt et le retrait sont admin-only en RLS ; l'écran n'affiche pas ce qu'il ne peut pas faire. */
  isAdmin: boolean;
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function LigneErreur({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}

// ─── Aperçu ───────────────────────────────────────────────────────────────────

function Apercu({
  doc,
  url,
  onFermer,
}: {
  doc: DocumentLotissement;
  url: string;
  onFermer: () => void;
}) {
  const genre = apercuPossible(doc);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-inset">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground">
          {doc.nom_fichier ?? doc.titre ?? "Aperçu"}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onFermer} aria-label="Fermer l'aperçu">
          <X />
        </Button>
      </div>
      {genre === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.titre ?? "Plan de morcellement"} className="max-h-[70vh] w-full object-contain" />
      ) : (
        // Le visualiseur PDF natif du navigateur : rien à embarquer, il gère le
        // zoom et l'impression, ce qu'un plan de 849 lots demande forcément.
        <iframe
          src={url}
          title={doc.titre ?? "Plan de morcellement"}
          className="h-[70vh] w-full border-0 bg-white"
        />
      )}
    </div>
  );
}

// ─── Formulaire de dépôt ──────────────────────────────────────────────────────

function FormulaireDepot({
  lotissementId,
  onDepose,
  onAnnuler,
}: {
  lotissementId: string;
  onDepose: () => void;
  onAnnuler: () => void;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [emetteur, setEmetteur] = useState("");
  const [dateDocument, setDateDocument] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = async () => {
    if (!fichier) return;
    setEnvoi(true);
    setErreur(null);
    const { error } = await deposerPlanLotissement({
      lotissementId,
      fichier,
      titre,
      emetteur: emetteur || null,
      dateDocument: dateDocument || null,
    });
    setEnvoi(false);
    if (error) {
      setErreur(error);
      return;
    }
    onDepose();
  };

  const ext = extensionDe(fichier?.name);

  return (
    <div className="space-y-4 border-t border-border bg-inset/40 px-5 py-4">
      <div className="space-y-1.5">
        <label htmlFor="plan-fichier" className="text-[13px] font-semibold text-foreground">
          Fichier du plan <span className="text-danger" aria-hidden>*</span>
        </label>
        {/*
          PAS d'attribut `accept` — volontairement, et c'est le cœur de la
          demande. En ajouter un rendrait invisibles, dans le sélecteur de
          fichiers du système, tous les formats non listés : l'utilisateur ne
          verrait même pas son .dwg. Le refus serait silencieux et
          incompréhensible.
        */}
        <input
          id="plan-fichier"
          type="file"
          onChange={(e) => {
            setFichier(e.target.files?.[0] ?? null);
            setErreur(null);
          }}
          disabled={envoi}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent hover:file:bg-accent/20"
        />
        <p className="text-xs text-muted-foreground">
          Tous les formats sont acceptés — PDF ou image scannée, CAO (.dwg,
          .dxf), géographique (.kml, .kmz, .geojson, .shp/.zip). Le fichier est
          conservé tel quel et restitué sous son nom d&apos;origine.
        </p>
        {fichier && (
          <p className="text-xs font-medium text-foreground">
            {fichier.name}
            {ext && <> · <span className="uppercase">{ext}</span></>}
            {fichier.size > 0 && <> · {tailleLisible(fichier.size)}</>}
            {" · "}
            {apercuPossible({ type_mime: fichier.type || null, nom_fichier: fichier.name })
              ? "aperçu possible dans le navigateur"
              : "sera proposé au téléchargement (le navigateur ne sait pas l'afficher)"}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre" htmlFor="plan-titre">
          <Input
            id="plan-titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Plan de morcellement"
            disabled={envoi}
          />
        </Field>
        <Field label="Émetteur" htmlFor="plan-emetteur">
          <Input
            id="plan-emetteur"
            value={emetteur}
            onChange={(e) => setEmetteur(e.target.value)}
            placeholder="Cabinet de géomètre, direction…"
            disabled={envoi}
          />
        </Field>
      </div>

      <Field label="Date du document" htmlFor="plan-date">
        <Input
          id="plan-date"
          type="date"
          value={dateDocument}
          onChange={(e) => setDateDocument(e.target.value)}
          disabled={envoi}
        />
      </Field>

      {erreur && <LigneErreur message={erreur} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </Button>
        <Button type="button" variant="primary" onClick={soumettre} disabled={envoi || !fichier}>
          {envoi ? <Loader2 className="animate-spin" /> : <Upload />}
          {envoi ? "Dépôt en cours…" : "Déposer le plan"}
        </Button>
      </div>
    </div>
  );
}

// ─── Carte ────────────────────────────────────────────────────────────────────

export default function PlanLotissementCard({ lotissementId, isAdmin }: Props) {
  const [plans, setPlans] = useState<DocumentLotissement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [apercu, setApercu] = useState<{ id: string; url: string } | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  // Compteur de rechargement plutôt qu'un appel direct : la mise à jour d'état
  // vit dans le `.then`, jamais dans le corps de l'effet — même forme que
  // `LotissementsPage`. Un `setState` synchrone dans un effet déclenche des
  // rendus en cascade, et le lint du dépôt le refuse.
  const [rechargements, setRechargements] = useState(0);

  useEffect(() => {
    let annule = false;
    void getPlansLotissement(lotissementId).then(({ data, error }) => {
      if (annule) return;
      // Un échec de lecture et un dossier vide ne doivent pas se ressembler :
      // sans ce message, une RLS qui refuse afficherait « Aucun plan déposé »,
      // c'est-à-dire exactement ce qu'affiche un lotissement sans plan.
      setErreur(error ? `Lecture des plans impossible : ${error.message}` : null);
      setPlans(data);
      setChargement(false);
    });
    return () => {
      annule = true;
    };
  }, [lotissementId, rechargements]);

  /** Gestionnaire d'événement (dépôt, retrait) — pas un effet. */
  const recharger = useCallback(() => {
    setChargement(true);
    setRechargements((n) => n + 1);
  }, []);

  const ouvrirApercu = async (doc: DocumentLotissement) => {
    setEnCours(doc.id);
    setErreur(null);
    const { url, error } = await urlSigneePlan(doc.id);
    setEnCours(null);
    if (error || !url) {
      setErreur(error ?? "Aperçu indisponible.");
      return;
    }
    setApercu({ id: doc.id, url });
  };

  const lancerTelechargement = async (doc: DocumentLotissement) => {
    setEnCours(doc.id);
    setErreur(null);
    const { error } = await telechargerPlan(doc);
    setEnCours(null);
    if (error) setErreur(error);
  };

  const retirer = async (doc: DocumentLotissement) => {
    if (!confirm(`Retirer « ${doc.titre ?? doc.nom_fichier} » du registre ? Le fichier sera supprimé.`)) return;
    setEnCours(doc.id);
    setErreur(null);
    const { error } = await supprimerPlanLotissement(doc);
    setEnCours(null);
    if (error) {
      setErreur(error);
      return;
    }
    if (apercu?.id === doc.id) setApercu(null);
    recharger();
  };

  return (
    /* `id` stable : le contrôle e2e a besoin d'une ancre sur la CARTE entière.
       Cibler « le div qui contient le titre » attrapait la barre d'en-tête
       seule, et tous les contrôles de contenu lisaient un texte tronqué. */
    <Card id="plan-lotissement" className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-5 py-4">
        <MapIcon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Plan de morcellement ({plans.length})</h2>
        {isAdmin && !formOuvert && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:ml-auto"
            onClick={() => setFormOuvert(true)}
          >
            <Upload />
            Déposer un plan
          </Button>
        )}
      </div>

      {formOuvert && (
        <FormulaireDepot
          lotissementId={lotissementId}
          onAnnuler={() => setFormOuvert(false)}
          onDepose={() => {
            setFormOuvert(false);
            recharger();
          }}
        />
      )}

      <div className="space-y-3 px-5 py-4">
        {erreur && <LigneErreur message={erreur} />}

        {chargement ? (
          <p className="py-4 text-sm text-muted-foreground">Chargement des plans…</p>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <FileText className="mb-2 h-7 w-7 text-muted-2" />
            <p className="text-sm text-muted-foreground">Aucun plan de morcellement déposé.</p>
            <p className="mt-1 max-w-md text-xs text-muted-2">
              Le plan situe chaque îlot et chaque lot dans le périmètre. Il est
              conservé dans son format d&apos;origine, quel qu&apos;il soit.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {plans.map((doc) => {
              const genre = apercuPossible(doc);
              const ext = extensionDe(doc.nom_fichier);
              const taille = tailleLisible(doc.taille_octets);
              const occupe = enCours === doc.id;
              return (
                <li key={doc.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {doc.titre ?? doc.nom_fichier ?? "Plan"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {ext ? (
                          <Badge tone="neutral" className="uppercase">{ext}</Badge>
                        ) : (
                          <Badge tone="neutral">sans extension</Badge>
                        )}
                        {taille && <span>{taille}</span>}
                        {doc.emetteur && <span>· {doc.emetteur}</span>}
                        {fmtDate(doc.date_document) && <span>· {fmtDate(doc.date_document)}</span>}
                      </p>
                      {doc.nom_fichier && doc.nom_fichier !== doc.titre && (
                        <p className="mt-0.5 truncate text-xs text-muted-2" title={doc.nom_fichier}>
                          {doc.nom_fichier}
                        </p>
                      )}
                      {!genre && (
                        <p className="mt-1 text-xs text-muted-2">
                          Aperçu indisponible dans le navigateur — le fichier se
                          télécharge tel qu&apos;il a été déposé.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {genre && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={occupe}
                          onClick={() =>
                            apercu?.id === doc.id ? setApercu(null) : void ouvrirApercu(doc)
                          }
                          title="Aperçu"
                          aria-label={`Aperçu de ${doc.titre ?? doc.nom_fichier ?? "ce plan"}`}
                        >
                          {occupe ? <Loader2 className="animate-spin" /> : <Eye />}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={occupe}
                        onClick={() => void lancerTelechargement(doc)}
                        title="Télécharger le fichier d'origine"
                        aria-label={`Télécharger ${doc.nom_fichier ?? "le plan"}`}
                      >
                        {occupe ? <Loader2 className="animate-spin" /> : <Download />}
                      </Button>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={occupe}
                          onClick={() => void retirer(doc)}
                          title="Retirer du registre"
                          aria-label={`Retirer ${doc.titre ?? "ce plan"}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>

                  {apercu?.id === doc.id && (
                    <Apercu doc={doc} url={apercu.url} onFermer={() => setApercu(null)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
