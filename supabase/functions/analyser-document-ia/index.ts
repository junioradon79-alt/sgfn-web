// SGFN — Edge Function : ANALYSE IA DE DOCUMENTS FONCIERS
// Reçoit un document (PDF ou image) encodé en base64, appelle Claude pour
// extraire les informations foncières structurées. Lecture seule.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SYSTEM = `Tu es l'agent d'analyse documentaire de SGFN (Système de Gestion Foncière Numérique, Côte d'Ivoire).
On te soumet un document foncier : attestation de cession, APFC, certificat de vente, PV de réunion familiale, CNI, ou autre.

Analyse le document et réponds UNIQUEMENT avec un objet JSON valide (sans texte autour) respectant exactement ce schéma :
{
  "type_document": "attestation_cession" | "apfc" | "certificat_vente" | "pv_reunion_famille" | "cni" | "autre",
  "attributaire": "<NOM PRÉNOM complet de l'attributaire/bénéficiaire principal, ou null>",
  "ilot": "<numéro d'îlot, ou null>",
  "lot": "<numéro de lot/parcelle, ou null>",
  "lotissement": "<nom du lotissement ou village, ou null>",
  "date_document": "<date au format YYYY-MM-DD, ou null>",
  "signatures": {
    "chef_famille": <true si signature/cachet du chef de famille est visible et lisible>,
    "chef_village": <true si signature/cachet du chef de village ou chefferie est visible>,
    "sgfn": <true si signature ou cachet officiel SGFN est présent>,
    "notaire": <true si signature notariale ou officielle autre est présente>
  },
  "conformite": "conforme" | "non_conforme" | "a_verifier",
  "alertes": ["liste des anomalies ou points d'attention détectés"],
  "score_confiance": <entier 0-100 représentant la certitude globale de l'extraction>,
  "observations": "<remarques libres importantes, ou null>"
}

Règles strictes :
- Recopie fidèlement les noms, dates et numéros sans invention.
- Si une information est illisible ou absente du document, mets null.
- score_confiance : 90-100 = document net et complet ; 60-85 = quelques zones imprécises ; <50 = document très dégradé.
- conformite = "conforme" uniquement si le document est complet avec toutes les signatures attendues pour son type.
- conformite = "non_conforme" si anomalie évidente : signature requise absente, données incohérentes, document falsifié.
- conformite = "a_verifier" en cas de doute ou d'information manquante non critique.
- alertes = [] si aucune anomalie.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, erreur: "Non autorisé" }), { status: 401 });
  }

  let body: { contenu_base64: string; type_mime: string; nom_fichier?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, erreur: "Corps de requête invalide" }), { status: 400 });
  }

  const { contenu_base64, type_mime, nom_fichier } = body;
  if (!contenu_base64 || !type_mime) {
    return new Response(
      JSON.stringify({ ok: false, erreur: "contenu_base64 et type_mime sont requis" }),
      { status: 400 },
    );
  }

  const typesSupported = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!typesSupported.includes(type_mime)) {
    return new Response(
      JSON.stringify({ ok: false, erreur: `Type MIME non supporté : ${type_mime}` }),
      { status: 415 },
    );
  }

  // Construire le bloc de contenu selon le type
  type ContentBlock =
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const documentBlock: ContentBlock =
    type_mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: contenu_base64 } }
      : { type: "image", source: { type: "base64", media_type: type_mime, data: contenu_base64 } };

  const textBlock: ContentBlock = {
    type: "text",
    text: `Analyse ce document foncier${nom_fichier ? ` ("${nom_fichier}")` : ""} et extrais les informations selon le schéma demandé.`,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
    "anthropic-version": "2023-06-01",
  };
  // Beta PDF requis pour les documents PDF
  if (type_mime === "application/pdf") {
    headers["anthropic-beta"] = "pdfs-2024-09-25";
  }

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        { role: "user", content: [documentBlock, textBlock] },
      ],
    }),
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    console.error("Erreur API Anthropic:", errText);
    return new Response(
      JSON.stringify({ ok: false, erreur: "Erreur du service IA", detail: errText }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const anthropicData = await anthropicResp.json();
  const texte = ((anthropicData.content ?? []) as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  let resultat: unknown;
  try {
    resultat = JSON.parse(texte.replace(/```json\n?|```/g, "").trim());
  } catch {
    console.error("JSON IA illisible:", texte);
    return new Response(
      JSON.stringify({ ok: false, erreur: "Réponse IA non analysable", brut: texte }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true, resultat }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
