"use client";

// Corriger ce que le registre DIT d'un lot (`modification_lot`), et le numéro
// d'un îlot (`modification_ilot`). Types ouverts le 30/07/2026 à la chefferie,
// dans sa juridiction, et à l'administration.
//
// 🔴 CE QUE CES ÉCRANS NE FONT PAS, et pourquoi cela se lit ici autant que dans
// la fonction SQL :
//
//   • Ils ne déplacent JAMAIS un lot vers un autre îlot, ni un îlot vers un
//     autre lotissement. `_appliquer_modification_lot` n'écrit pas `ilot_id` et
//     `_appliquer_modification_ilot` n'écrit pas `lotissement_id` : un tel
//     déplacement ferait sortir le lot de la juridiction qui l'a soumis, et le
//     contrôle de `soumettre_saisie` — qui porte sur le lotissement d'ORIGINE —
//     ne le verrait pas passer.
//   • Ils ne touchent ni au `statut` du lot (il suit ses attributions, et
//     `maj_attributions` reste fermé à la chefferie), ni au gel juridique.
//
// ⚠️ Convention du payload, celle de `_appliquer_maj_attributaire` : **clé
// absente = valeur inchangée, clé présente à `null` = effacement**. Ces écrans
// n'envoient donc QUE les champs réellement modifiés — d'où le chargement
// préalable de la fiche d'origine, sans laquelle on ne saurait pas ce qui a
// bougé. (C'est la même prudence que `LotissementScreen`, pour une raison
// inverse : là-bas on renvoyait tout, ici on n'envoie que le delta.)

import { useCallback, useEffect, useState } from "react";
import { Grid2x2, Lock, SquarePen } from "lucide-react";

import { useRetourFormulaire } from "@/lib/android-back";
import {
  NATURE_DROIT_OPTIONS,
  type NatureDroit,
  type PayloadModificationIlot,
  type PayloadModificationLot,
  type ResumeIlot,
  type ResumeLot,
} from "@/lib/saisie";
import type { FicheLot, IlotOption, SaisieRegistre } from "../../../data/useSaisieRegistre";
import { AvertissementDocumentaire } from "../../../components/AvertissementDocumentaire";
import {
  Avertissement,
  BoutonEnvoyer,
  BoutonReessayer,
  Carte,
  Champ,
  ChampRecherche,
  Chargement,
  ChoixLotissement,
  EchecEnvoi,
  EcranSaisie,
  EnvoiConfirme,
  LigneChoix,
  Pastilles,
  RappelFile,
  SectionLabel,
  Texte,
  aideTypeInvalide,
  useEnvoi,
} from "./champs";

type Props = {
  api: SaisieRegistre;
  onBack: () => void;
  flash: (t: string) => void;
};

/** `null` en base et chaîne vide à l'écran disent la même chose. */
const texte = (v: string | number | null | undefined) => (v == null ? "" : String(v));

// 🔴 L'avertissement documentaire vit désormais dans
// `features/mobile/components/AvertissementDocumentaire.tsx`. Il était défini
// ICI, donc côté saisie seulement, et la file de validation mobile n'en
// affichait aucun : l'administrateur qui validait depuis son téléphone
// tranchait sans savoir, alors que l'arbitrage du propriétaire exige l'inverse.
// Ne pas le redéfinir localement — c'est l'écart, pas le composant.

// ═══════════════════════════════════════════════════════════════════════════
// Fiche descriptive d'un lot
// ═══════════════════════════════════════════════════════════════════════════

type ChampsLot = {
  numero_lot: string;
  numero_parcelle: string;
  superficie_m2: string;
  nature_droit: NatureDroit | null;
  observation: string;
  guide_page: string;
  latitude: string;
  longitude: string;
};

function depuisFicheLot(f: FicheLot): ChampsLot {
  return {
    numero_lot: texte(f.numero_lot),
    numero_parcelle: texte(f.numero_parcelle),
    superficie_m2: texte(f.superficie_m2),
    nature_droit: f.nature_droit,
    observation: texte(f.observation),
    guide_page: texte(f.guide_page),
    latitude: texte(f.latitude),
    longitude: texte(f.longitude),
  };
}

/** `""` à l'écran = `null` en base ; on ne distingue pas « vidé » de « jamais rempli ». */
const nombreOuNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function FicheLotScreen({ api, onBack, flash }: Props) {
  const [lotissementId, setLotissementId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [lots, setLots] = useState<{ id: string; label: string; detail: string }[]>([]);
  const [lotsErreur, setLotsErreur] = useState<string | null>(null);
  const [fiche, setFiche] = useState<FicheLot | null>(null);
  const [ficheErreur, setFicheErreur] = useState<string | null>(null);
  const [c, setC] = useState<ChampsLot | null>(null);
  const envoi = useEnvoi(api.soumettre);

  const chercher = useCallback(
    async (motif: string) => {
      if (!lotissementId) return;
      const r = await api.chercherLots(lotissementId, motif);
      if (!r.ok) {
        setLotsErreur(r.error);
        return;
      }
      setLotsErreur(null);
      setLots(
        r.valeur.map((l) => ({
          id: l.lot_id,
          label: `${l.verrouille ? "🔒 " : ""}Îlot ${l.ilot} · Lot ${l.numero_lot}`,
          detail: l.verrouille ? "gel juridique" : (l.attributaire_nom ?? "libre"),
        })),
      );
    },
    [api, lotissementId],
  );

  useEffect(() => {
    if (!lotissementId) return;
    const t = setTimeout(() => void chercher(recherche), 250);
    return () => clearTimeout(t);
  }, [lotissementId, recherche, chercher]);

  const ouvrirLot = async (lotId: string) => {
    setFicheErreur(null);
    const r = await api.chargerFicheLot(lotId);
    if (!r.ok) {
      setFicheErreur(r.error);
      return;
    }
    setFiche(r.valeur);
    setC(depuisFicheLot(r.valeur));
  };

  // Ce qui a réellement bougé — c'est aussi ce qui part dans le payload.
  const changes: Partial<PayloadModificationLot> = {};
  if (fiche && c) {
    const o = depuisFicheLot(fiche);
    if (c.numero_lot.trim() && c.numero_lot.trim() !== o.numero_lot) changes.numero_lot = c.numero_lot.trim();
    if (c.numero_parcelle.trim() !== o.numero_parcelle) changes.numero_parcelle = c.numero_parcelle.trim() || null;
    if (c.superficie_m2.trim() !== o.superficie_m2) changes.superficie_m2 = nombreOuNull(c.superficie_m2);
    if (c.nature_droit !== o.nature_droit) changes.nature_droit = c.nature_droit;
    if (c.observation.trim() !== o.observation) changes.observation = c.observation.trim() || null;
    if (c.guide_page.trim() !== o.guide_page) changes.guide_page = nombreOuNull(c.guide_page);
    if (c.latitude.trim() !== o.latitude) changes.latitude = nombreOuNull(c.latitude);
    if (c.longitude.trim() !== o.longitude) changes.longitude = nombreOuNull(c.longitude);
  }
  const nbChanges = Object.keys(changes).length;

  useRetourFormulaire(nbChanges > 0 && !envoi.confirme, () =>
    flash("Appuyez à nouveau pour abandonner cette saisie"),
  );

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Fiche de lot"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          setFiche(null);
          setC(null);
          setRecherche("");
        }}
      />
    );
  }

  if (!lotissementId) {
    return (
      <EcranSaisie titre="Fiche de lot" sousTitre="Choisir le lotissement" onBack={onBack}>
        <RappelFile />
        <ChoixLotissement
          lotissements={api.lotissements}
          onChoisir={setLotissementId}
          loading={api.loading}
          erreur={api.erreur}
          recharger={() => void api.recharger()}
        />
      </EcranSaisie>
    );
  }

  if (!fiche || !c) {
    return (
      <EcranSaisie titre="Fiche de lot" sousTitre="Choisir le lot à corriger" onBack={onBack}>
        <AvertissementDocumentaire lotissementId={lotissementId} />
        {ficheErreur && (
          <div className="mb-3 space-y-2">
            <Avertissement>Fiche du lot illisible : {ficheErreur}</Avertissement>
          </div>
        )}
        <ChampRecherche value={recherche} onChange={setRecherche} placeholder="Numéro de lot…" />
        {lotsErreur ? (
          <div className="mt-3 space-y-2">
            <Avertissement>Liste des lots illisible : {lotsErreur}</Avertissement>
            <BoutonReessayer onClick={() => void chercher(recherche)} />
          </div>
        ) : (
          <div className="mt-3 rounded-[18px] border border-border bg-card px-3 shadow-panel">
            {lots.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                Aucun lot ne correspond.
              </div>
            ) : (
              lots.map((l) => (
                <LigneChoix key={l.id} titre={l.label} detail={l.detail} onClick={() => void ouvrirLot(l.id)} />
              ))
            )}
          </div>
        )}
      </EcranSaisie>
    );
  }

  const designation = `Îlot ${fiche.ilot_numero} · Lot ${texte(fiche.numero_lot) || "—"}`;

  const envoyer = () => {
    const payload: PayloadModificationLot = { lot_id: fiche.id, ...changes };
    const resume: ResumeLot = {
      designation,
      lotissement: api.lotissements.find((l) => l.id === lotissementId)?.nom ?? null,
      champs_modifies: nbChanges,
    };
    void envoi.envoyer(
      { type: "modification_lot", lotissementId: null, titre: `Correction de lot — ${designation}`, payload, resume },
      `${designation} — ${nbChanges} champ(s) corrigé(s).`,
    );
  };

  return (
    <EcranSaisie
      titre="Fiche de lot"
      sousTitre={designation}
      onBack={onBack}
      action={
        <BoutonEnvoyer
          onClick={envoyer}
          disabled={nbChanges === 0 || fiche.verrouille}
          enCours={envoi.enCours}
        />
      }
    >
      <RappelFile />
      <AvertissementDocumentaire lotissementId={lotissementId} />

      {/* 🔴 Le gel juridique est refusé DÈS LA SOUMISSION depuis le 30/07
          (migration 20260730090000) : `soumettre_saisie` rend l'erreur à la
          personne qui saisit. Auparavant seule `_appliquer_modification_lot`
          refusait, c'est-à-dire que la chefferie remplissait, envoyait, et
          c'est l'ADMINISTRATEUR qui recevait l'erreur — sans rien pouvoir en
          faire. Le dire ici, avant que la fiche ne soit remplie, et non après. */}
      {fiche.verrouille && (
        <div className="mb-4">
          <Avertissement>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" strokeWidth={2} />
              <b>Ce lot est sous gel juridique.</b>
            </span>{" "}
            Sa fiche ne peut pas être corrigée : le serveur refuse la soumission. Le gel se
            lève depuis la fiche du lot, par un administrateur.
          </Avertissement>
        </div>
      )}

      {envoi.erreur && (
        <div className="mb-4">
          <EchecEnvoi
            erreur={envoi.erreur}
            incertain={envoi.erreurIncertaine}
            aide={aideTypeInvalide(envoi.erreur)}
          />
        </div>
      )}

      <SectionLabel>
        <SquarePen className="mr-1.5 inline size-3.5" strokeWidth={2} />
        Désignation
      </SectionLabel>
      <Carte>
        <Champ label="Numéro du lot" aide="Laissé vide, le numéro actuel est conservé.">
          <Texte
            value={c.numero_lot}
            onChange={(v) => setC({ ...c, numero_lot: v })}
            autoCapitalize="characters"
          />
        </Champ>
        <Champ label="Numéro de parcelle">
          <Texte
            value={c.numero_parcelle}
            onChange={(v) => setC({ ...c, numero_parcelle: v })}
            autoCapitalize="characters"
          />
        </Champ>
        <Champ label="Superficie (m²)">
          <Texte
            value={c.superficie_m2}
            onChange={(v) => setC({ ...c, superficie_m2: v })}
            inputMode="numeric"
          />
        </Champ>
      </Carte>

      <SectionLabel className="mt-5">Nature du droit</SectionLabel>
      <Carte>
        <Pastilles
          options={NATURE_DROIT_OPTIONS}
          value={c.nature_droit}
          onChange={(v) => setC({ ...c, nature_droit: v })}
        />
      </Carte>

      <SectionLabel className="mt-5">Repères et observation</SectionLabel>
      <Carte>
        <Champ label="Page du guide de répartition">
          <Texte
            value={c.guide_page}
            onChange={(v) => setC({ ...c, guide_page: v })}
            inputMode="numeric"
          />
        </Champ>
        <Champ label="Latitude">
          <Texte value={c.latitude} onChange={(v) => setC({ ...c, latitude: v })} inputMode="numeric" />
        </Champ>
        <Champ label="Longitude">
          <Texte value={c.longitude} onChange={(v) => setC({ ...c, longitude: v })} inputMode="numeric" />
        </Champ>
        <Champ label="Observation">
          <Texte value={c.observation} onChange={(v) => setC({ ...c, observation: v })} />
        </Champ>
      </Carte>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        {nbChanges === 0
          ? "Aucun champ modifié pour l'instant — seuls les champs réellement changés seront envoyés."
          : `${nbChanges} champ(s) modifié(s). Les autres resteront tels quels : ils ne partent pas dans la soumission.`}
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
        Cet écran ne change ni l&apos;îlot du lot, ni son statut, ni son attributaire. Pour
        changer d&apos;attributaire, c&apos;est le registre national qui saisit.
      </p>
    </EcranSaisie>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Numéro d'un îlot
// ═══════════════════════════════════════════════════════════════════════════

export function IlotScreen({ api, onBack, flash }: Props) {
  const [lotissementId, setLotissementId] = useState<string | null>(null);
  const [ilots, setIlots] = useState<IlotOption[] | null>(null);
  const [ilotsErreur, setIlotsErreur] = useState<string | null>(null);
  const [choisi, setChoisi] = useState<IlotOption | null>(null);
  const [numero, setNumero] = useState("");
  const envoi = useEnvoi(api.soumettre);

  const chargerIlots = useCallback(
    async (id: string) => {
      const r = await api.chargerIlots(id);
      if (!r.ok) {
        setIlotsErreur(r.error);
        setIlots([]);
        return;
      }
      setIlotsErreur(null);
      setIlots(r.valeur);
    },
    [api],
  );

  useEffect(() => {
    if (!lotissementId) return;
    // Enveloppé : le premier `setState` n'a lieu qu'au retour du réseau, jamais
    // pendant le rendu de l'effet (règle `react-hooks/set-state-in-effect`).
    void (async () => {
      await chargerIlots(lotissementId);
    })();
  }, [lotissementId, chargerIlots]);

  const change = !!choisi && numero.trim().length > 0 && numero.trim() !== choisi.numero;

  useRetourFormulaire(change && !envoi.confirme, () =>
    flash("Appuyez à nouveau pour abandonner cette saisie"),
  );

  if (envoi.confirme) {
    return (
      <EnvoiConfirme
        titre="Numéro d'îlot"
        onBack={onBack}
        recapitulatif={envoi.confirme}
        onNouvelle={() => {
          envoi.reprendre();
          setChoisi(null);
          setNumero("");
          if (lotissementId) void chargerIlots(lotissementId);
        }}
      />
    );
  }

  if (!lotissementId) {
    return (
      <EcranSaisie titre="Numéro d'îlot" sousTitre="Choisir le lotissement" onBack={onBack}>
        <RappelFile />
        <ChoixLotissement
          lotissements={api.lotissements}
          onChoisir={setLotissementId}
          loading={api.loading}
          erreur={api.erreur}
          recharger={() => void api.recharger()}
        />
      </EcranSaisie>
    );
  }

  if (!choisi) {
    return (
      <EcranSaisie titre="Numéro d'îlot" sousTitre="Choisir l'îlot" onBack={onBack}>
        <AvertissementDocumentaire lotissementId={lotissementId} />
        {ilotsErreur && (
          <div className="mb-3 space-y-2">
            <Avertissement>Liste des îlots illisible : {ilotsErreur}</Avertissement>
            <BoutonReessayer onClick={() => void chargerIlots(lotissementId)} />
          </div>
        )}
        {ilots === null ? (
          <Chargement texte="Chargement des îlots…" />
        ) : (
          <div className="rounded-[18px] border border-border bg-card px-3 shadow-panel">
            {ilots.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                Ce lotissement ne compte aucun îlot.
              </div>
            ) : (
              ilots.map((i) => (
                <LigneChoix
                  key={i.id}
                  titre={`Îlot ${i.numero}`}
                  detail={`${i.nb_lots} lot(s)`}
                  onClick={() => {
                    setChoisi(i);
                    setNumero(i.numero);
                  }}
                />
              ))
            )}
          </div>
        )}
      </EcranSaisie>
    );
  }

  const envoyer = () => {
    const payload: PayloadModificationIlot = { ilot_id: choisi.id, numero: numero.trim() };
    const resume: ResumeIlot = {
      numero_avant: choisi.numero,
      numero_apres: numero.trim(),
      lotissement: api.lotissements.find((l) => l.id === lotissementId)?.nom ?? null,
      nb_lots: choisi.nb_lots,
    };
    void envoi.envoyer(
      {
        type: "modification_ilot",
        lotissementId: null,
        titre: `Renumérotation d'îlot — ${choisi.numero} → ${numero.trim()}`,
        payload,
        resume,
      },
      `Îlot ${choisi.numero} → ${numero.trim()} (${choisi.nb_lots} lot(s) concernés).`,
    );
  };

  return (
    <EcranSaisie
      titre="Numéro d'îlot"
      sousTitre={`Îlot ${choisi.numero}`}
      onBack={onBack}
      action={<BoutonEnvoyer onClick={envoyer} disabled={!change} enCours={envoi.enCours} />}
    >
      <RappelFile />
      <AvertissementDocumentaire lotissementId={lotissementId} />

      {envoi.erreur && (
        <div className="mb-4">
          <EchecEnvoi
            erreur={envoi.erreur}
            incertain={envoi.erreurIncertaine}
            aide={aideTypeInvalide(envoi.erreur)}
          />
        </div>
      )}

      {/* Un mot changé, et toute la désignation de ses lots change avec lui. */}
      {choisi.nb_lots > 0 && (
        <div className="mb-4">
          <Avertissement>
            Cet îlot porte <b>{choisi.nb_lots} lot(s)</b>. Les renuméroter change leur
            désignation partout — y compris sur les attestations qui seront délivrées
            ensuite. Les attestations <b>déjà délivrées</b>, elles, gardent l&apos;ancien
            numéro imprimé.
          </Avertissement>
        </div>
      )}

      <SectionLabel>
        <Grid2x2 className="mr-1.5 inline size-3.5" strokeWidth={2} />
        Numéro
      </SectionLabel>
      <Carte>
        <Champ label="Numéro de l'îlot" obligatoire aide="Un numéro vide serait refusé : l'îlot garderait l'ancien.">
          <Texte value={numero} onChange={setNumero} autoCapitalize="characters" />
        </Champ>
      </Carte>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        Cet écran ne déplace pas l&apos;îlot vers un autre lotissement : il n&apos;en corrige
        que le numéro.
      </p>
    </EcranSaisie>
  );
}
