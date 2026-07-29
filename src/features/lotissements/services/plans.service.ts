import { createClient } from "@/utils/supabase/client";

import type { Database } from "../../../../database.types";

/**
 * Pièces de référence d'un LOTISSEMENT — à commencer par le plan de
 * morcellement.
 *
 * ── « Conserver toutes les extensions » (demande du 29/07) ──────────────────
 * Aucune liste blanche, ici ni ailleurs dans ce module. Le champ de fichier de
 * l'écran est sans `accept`, le bucket `documents` est sans restriction MIME ni
 * limite de taille, et la RLS ne regarde pas le format. Un PDF scanné, un JPEG,
 * un DWG, un DXF, un KMZ, un SHP zippé ou un GeoTIFF entrent par le même
 * chemin, et ressortent **octet pour octet** sous leur nom d'origine.
 *
 * Ce qui rend cette fidélité possible tient en trois colonnes ajoutées par la
 * migration 20260729170000 :
 *   · `nom_fichier`   — le nom réel, extension comprise ;
 *   · `type_mime`     — ce que le navigateur a annoncé, ou rien ;
 *   · `taille_octets` — pour annoncer le poids avant un téléchargement.
 *
 * La CLÉ de stockage, elle, reste technique (`<lotissement>/<id>.<ext>`). Y
 * écrire le nom d'origine exposerait la clé aux espaces, aux accents et au
 * « # » — le plan fourni s'appelle « Plan de Morcellement Brignan Kakodji
 * (Ebimpé 2020).pdf », trois pièges sur quatre dès le premier fichier réel.
 * Le nom vit en base, la clé reste inerte.
 *
 * ⚠️ Client `@/utils/supabase/client` et non le singleton `@/lib/supabase` :
 * la session de `/login` vit dans un COOKIE, pas dans le localStorage. Se
 * tromper de client revient à interroger la base en anonyme — sans erreur, la
 * RLS répondant « 0 ligne » en lecture.
 */

export type DocumentLotissement =
  Database["public"]["Tables"]["documents"]["Row"];

/** Extension d'origine, en minuscules, sans le point. `""` si le nom n'en a pas. */
export function extensionDe(nomFichier: string | null | undefined): string {
  if (!nomFichier) return "";
  const dernierPoint = nomFichier.lastIndexOf(".");
  // `lastIndexOf > 0` et non `>= 0` : « .gitignore » n'a pas d'extension, il a
  // un nom qui commence par un point.
  if (dernierPoint <= 0 || dernierPoint === nomFichier.length - 1) return "";
  return nomFichier.slice(dernierPoint + 1).toLowerCase();
}

/**
 * Ce que le NAVIGATEUR sait afficher lui-même, et rien de plus.
 *
 * Volontairement fondé sur le type MIME **et** sur l'extension : un `.dwg`
 * arrive souvent avec un `type` vide, et un PDF déposé depuis certains clients
 * mobiles arrive en `application/octet-stream`. Se fier au seul MIME priverait
 * d'aperçu des fichiers parfaitement affichables.
 *
 * Tout ce qui n'est pas listé ici n'est pas refusé — il est simplement
 * **téléchargé** au lieu d'être affiché. C'est la différence entre « je ne sais
 * pas le montrer » et « je ne l'accepte pas », et c'est toute la demande.
 */
/** Types que TOUT navigateur rend dans une balise `<img>`. Liste close. */
const IMAGES_NAVIGATEUR = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/svg+xml",
]);

/** Extensions correspondantes, pour les fichiers arrivés sans type MIME. */
const EXTENSIONS_IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"];

export function apercuPossible(doc: {
  type_mime: string | null;
  nom_fichier: string | null;
}): "pdf" | "image" | null {
  const ext = extensionDe(doc.nom_fichier);
  const mime = (doc.type_mime ?? "").toLowerCase().trim();

  if (mime === "application/pdf" || ext === "pdf") return "pdf";

  // 🔴 Écrit d'abord `mime.startsWith("image/")`. Piège relevé par le contrôle
  // e2e sur un vrai .dwg : le type MIME officiel du DWG est `image/vnd.dwg`.
  // Le préfixe « image/ » ne veut donc PAS dire « affichable » — la famille
  // contient aussi image/vnd.dxf, image/vnd.dgn, image/x-tga… Le bouton
  // « Aperçu » s'affichait sur un plan CAO et ouvrait une image cassée : la
  // pire des trois issues, puisqu'elle ressemble à une panne alors que le
  // fichier est parfaitement intact et téléchargeable.
  // Liste close, donc : elle ne borne QUE l'aperçu, jamais l'acceptation.
  if (IMAGES_NAVIGATEUR.has(mime)) return "image";
  if (mime === "" && EXTENSIONS_IMAGE.includes(ext)) return "image";
  // Type générique posé par certains clients mobiles sur de vraies images :
  // l'extension tranche, faute de mieux.
  if (mime === "application/octet-stream" && EXTENSIONS_IMAGE.includes(ext)) return "image";
  return null;
}

/** « 4,2 Mo » — un plan CAO se compte en dizaines de Mo, l'annoncer évite la surprise. */
export function tailleLisible(octets: number | null): string | null {
  if (octets == null || octets < 0) return null;
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Clé de stockage : normalisée, jetable, sans rapport avec ce que verra
 * l'utilisateur. L'extension d'origine y est conservée quand elle est sûre —
 * elle aide à reconnaître un objet dans la console Storage — mais elle est
 * bornée : lettres et chiffres, 12 caractères au plus. Un nom sans extension
 * donne une clé sans suffixe, ce qui est licite.
 */
export function cheminStockage(lotissementId: string, documentId: string, nomFichier: string): string {
  const brut = extensionDe(nomFichier).replace(/[^a-z0-9]/g, "");
  const ext = brut.slice(0, 12);
  return `plans-lotissement/${lotissementId}/${documentId}${ext ? `.${ext}` : ""}`;
}

/** Plans et pièces de référence d'un lotissement, du plus récent au plus ancien. */
export async function getPlansLotissement(lotissementId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("lotissement_id", lotissementId)
    .eq("type", "plan_lotissement")
    .order("televerse_le", { ascending: false });

  return { data: (data ?? []) as DocumentLotissement[], error };
}

export type NouveauPlan = {
  lotissementId: string;
  fichier: File;
  titre: string;
  emetteur: string | null;
  dateDocument: string | null;
};

/**
 * Dépôt en deux temps : l'objet d'abord, la ligne ensuite.
 *
 * L'ordre compte. Écrire la ligne en premier laisserait, si le téléversement
 * échouait, une entrée de registre pointant vers un fichier inexistant —
 * c'est-à-dire un plan qui s'affiche à l'écran et qu'on ne peut pas ouvrir.
 * Dans l'autre sens, l'échec ne laisse qu'un objet orphelin dans le bucket,
 * invisible et sans conséquence pour le registre.
 *
 * `contentType` est posé explicitement : sans lui, Storage étiquette tout en
 * `application/octet-stream` et le navigateur téléchargerait même les PDF au
 * lieu de les afficher. Quand le navigateur n'annonce rien (cas courant du
 * `.dwg` et du `.shp`), on assume `application/octet-stream` — le fichier
 * reste intact, seul l'aperçu est perdu, ce qui est exactement le comportement
 * attendu pour un format que le navigateur ne sait pas montrer.
 */
export async function deposerPlanLotissement({
  lotissementId,
  fichier,
  titre,
  emetteur,
  dateDocument,
}: NouveauPlan): Promise<{ error: string | null }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée — reconnectez-vous." };

  const id = crypto.randomUUID();
  const chemin = cheminStockage(lotissementId, id, fichier.name);

  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(chemin, fichier, {
      contentType: fichier.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { error: `Téléversement refusé : ${uploadErr.message}` };

  const { error: insertErr } = await supabase.from("documents").insert({
    id,
    type: "plan_lotissement",
    lotissement_id: lotissementId,
    titre: titre.trim() || fichier.name,
    emetteur: emetteur?.trim() || null,
    date_document: dateDocument || null,
    url_fichier: chemin,
    nom_fichier: fichier.name,
    type_mime: fichier.type || null,
    taille_octets: fichier.size,
    televerse_par: user.id,
  });

  if (insertErr) {
    // La ligne n'existera pas : on retire l'objet plutôt que de le laisser
    // occuper le bucket sans que rien ne le référence.
    await supabase.storage.from("documents").remove([chemin]);
    return { error: `Enregistrement au registre refusé : ${insertErr.message}` };
  }

  return { error: null };
}

/**
 * URL signée (120 s) vers le fichier, obtenue par l'edge function
 * `telecharger-document`.
 *
 * Pourquoi pas `createSignedUrl` directement : le bucket est privé et
 * `storage.objects` n'a AUCUNE policy de lecture sur ce préfixe. Seul l'admin
 * pourrait signer, et la chefferie, l'opérateur et l'attributaire — qui ont
 * pourtant le droit de lire la ligne — obtiendraient un refus. L'edge function
 * relit d'abord la ligne avec le jeton de l'appelant, donc sous la RLS, avant
 * de signer en service_role : une seule règle d'accès, celle de la table.
 *
 * 🔴 POURQUOI `fetch` ET NON `invokeEdge` / `functions.invoke` ICI.
 * Première version écrite avec `invokeEdge` (helper de la dette #23) : aperçu
 * et téléchargement échouaient tous les deux, sur le message de repli générique
 * — c'est-à-dire en masquant leur propre cause, l'ironie exacte que ce helper
 * existe pour corriger. Motif réel : `telecharger-document` répond
 * `Access-Control-Allow-Headers: "content-type, authorization"`, et
 * `functions.invoke` ajoute `x-client-info`. Le préflight CORS échoue, `invoke`
 * lève, et il ne reste que le repli. C'est précisément pour cela que les cinq
 * appelants existants de cette fonction utilisent `fetch` à la main.
 *
 * Et le repli n'est pas dégradé pour autant : avec `fetch`, le corps de la
 * réponse n'est jamais caché — on lit `erreur` directement, ce qui donne le
 * motif du SERVEUR sans aucun helper. La dette #23 n'a pas de prise ici.
 *
 * Élargir la liste CORS de l'edge function marcherait aussi, mais elle est
 * partagée par cinq écrans qui fonctionnent : le redéploiement n'est pas à la
 * charge de ce chantier. Signalé au coordinateur.
 */
export async function urlSigneePlan(documentId: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let reponse: Response;
  try {
    reponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ table: "documents", reference: documentId }),
    });
  } catch {
    return { url: null, error: "Le serveur de fichiers est injoignable — vérifiez votre connexion." };
  }

  let corps: { url?: string; erreur?: string } | null = null;
  try {
    corps = await reponse.json();
  } catch {
    /* corps non JSON : on retombe sur le statut ci-dessous */
  }

  if (!reponse.ok) {
    // Le motif du serveur, tel qu'il l'a écrit. Le repli ne sert qu'à l'absence
    // de corps exploitable (crash Deno, page d'erreur de plateforme).
    return { url: null, error: corps?.erreur ?? `Le fichier n'a pas pu être récupéré (HTTP ${reponse.status}).` };
  }
  if (!corps?.url) return { url: null, error: "Le serveur n'a renvoyé aucun lien de téléchargement." };
  return { url: corps.url, error: null };
}

/**
 * Téléchargement FIDÈLE : le fichier redescend sous son nom d'origine.
 *
 * L'URL signée pointe vers une clé technique (`<uuid>.pdf`) : l'ouvrir dans un
 * onglet enregistrerait le plan sous ce nom-là. On passe donc par un blob et un
 * `<a download>`, seul moyen d'imposer `nom_fichier` sans toucher à l'edge
 * function — laquelle est partagée par cinq autres écrans qu'il n'y a aucune
 * raison de redéployer pour cela.
 */
export async function telechargerPlan(doc: DocumentLotissement): Promise<{ error: string | null }> {
  const { url, error } = await urlSigneePlan(doc.id);
  if (error || !url) return { error: error ?? "Lien indisponible." };

  let blob: Blob;
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return { error: `Le fichier n'a pas pu être lu (HTTP ${reponse.status}).` };
    blob = await reponse.blob();
  } catch {
    return { error: "Le téléchargement a été interrompu — vérifiez votre connexion." };
  }

  const lienObjet = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = lienObjet;
  a.download = doc.nom_fichier ?? doc.titre ?? "plan";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Révocation différée : Safari annule le téléchargement si l'URL objet
  // disparaît dans la même tâche que le clic.
  setTimeout(() => URL.revokeObjectURL(lienObjet), 60_000);

  return { error: null };
}

/** Retrait d'un plan — admin seul (RLS). L'objet part avec la ligne. */
export async function supprimerPlanLotissement(doc: DocumentLotissement): Promise<{ error: string | null }> {
  const supabase = createClient();

  // La ligne d'abord : si la RLS refuse, le fichier n'a pas à disparaître.
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", doc.id)
    .select("id");
  if (error) return { error: error.message };
  // Un DELETE non couvert par la RLS ne lève RIEN : il touche 0 ligne. Sans ce
  // comptage, un refus s'afficherait comme une suppression réussie.
  if (!data || data.length === 0) {
    return { error: "Suppression refusée — seul un administrateur peut retirer un plan." };
  }

  // 🔴 Le retour de `remove()` était IGNORÉ. Les 21 objets déposés par les
  // contrôles e2e sont ainsi restés dans le bucket, la ligne supprimée et
  // l'écran affichant un retrait réussi. `storage.remove()` ne lève d'ailleurs
  // rien quand il ne trouve pas l'objet : il rend une liste vide. Ne pas la
  // regarder, c'était garantir de ne jamais voir la panne.
  const { data: retires, error: storageErr } = await supabase.storage
    .from("documents")
    .remove([doc.url_fichier]);

  if (storageErr) {
    return { error: `Registre nettoyé, mais le fichier n'a pas pu être supprimé : ${storageErr.message}` };
  }
  if (!retires || retires.length === 0) {
    return {
      error:
        "Registre nettoyé, mais le fichier est resté dans l'espace de stockage " +
        `(${doc.url_fichier}) — signalez-le à un administrateur.`,
    };
  }
  return { error: null };
}
