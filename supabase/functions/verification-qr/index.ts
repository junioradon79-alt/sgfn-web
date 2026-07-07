// SGFN — Edge Function : VERIFICATION QR PUBLIQUE
// v16 : exception pour la 1re attestation de cession (rang 1, ayant-droit
// d'origine) — gratuite y compris en consultation, signalée par
// verifier_attestation() via `gratuite: true` (cession_id IS NULL). Toute
// attestation issue d'une cession (2e et suivantes) reste payante 60 000 FCFA
// (50 000 chefferie + 10 000 commission SGNF, décision du 07/07/2026).
// Le parcours amont (scan → identification du document) reste libre ; le
// verdict d'authenticité complet n'est renvoyé que si la consultation est payée.
// Certificats de vente et APFC restent gratuits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Dupliqué dans src/lib/consultation-qr.ts (front) — garder synchronisé.
const TARIF = { montant_total: 60000, part_chefferie: 50000, commission_sgnf: 10000 };
const TYPES_PAYANTS = new Set(["attestation_cession"]);
// Une consultation payée reste consultable 24 h (re-affichage, retour paiement)
const VALIDITE_PAIEMENT_MS = 24 * 60 * 60 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

function genJeton(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// Code court communiqué au guichet pour le paiement manuel — alphabet sans
// caractères ambigus (0/O, 1/I/L).
function genCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "CQR-" + Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}

function reponsePaiementRequis(
  refDoc: string,
  typeDocument: string,
  code: string,
  jeton: string,
  statutConsultation: string,
) {
  return new Response(
    JSON.stringify({
      statut: "paiement_requis",
      type_document: typeDocument,
      reference: refDoc,
      montant_total: TARIF.montant_total,
      code_consultation: code,
      jeton_consultation: jeton,
      statut_consultation: statutConsultation,
    }),
    { headers: cors, status: 200 },
  );
}

async function journaliser(req: Request, ref: string, typeDocument: string | null, resultat: string, lat: number | null, lon: number | null) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { error } = await supabase.from("scans_qr").insert({
    reference_saisie: ref.slice(0, 200),
    type_document: typeDocument,
    resultat,
    ip,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    latitude: lat,
    longitude: lon,
  });
  if (error) console.error("journalisation scan:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  let ref = url.searchParams.get("ref") ?? url.searchParams.get("token");
  let jetonConsultation = url.searchParams.get("consultation");
  let lat: number | null = null;
  let lon: number | null = null;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      ref = body.ref ?? ref;
      jetonConsultation = body.jeton_consultation ?? jetonConsultation;
      lat = typeof body.latitude === "number" ? body.latitude : null;
      lon = typeof body.longitude === "number" ? body.longitude : null;
    } catch { /* corps absent ou invalide : on retombe sur les query params */ }
  }

  if (!ref) {
    return new Response(JSON.stringify({ statut: "introuvable" }), { headers: cors, status: 400 });
  }

  const { data, error } = await supabase.rpc("verifier_document", { p_ref: ref });

  if (error) {
    console.error(error);
    await journaliser(req, ref, null, "erreur", lat, lon);
    return new Response(JSON.stringify({ statut: "erreur" }), { headers: cors, status: 500 });
  }
  if (!data || !data.type_document) {
    await journaliser(req, ref, null, "introuvable", lat, lon);
    return new Response(JSON.stringify({ statut: "introuvable" }), { headers: cors, status: 200 });
  }

  // Documents à consultation gratuite : verdict complet, comme avant.
  // Exception : la 1re attestation de cession (rang 1) est gratuite même en
  // consultation — cf. commentaire d'en-tête.
  if (!TYPES_PAYANTS.has(data.type_document) || data.gratuite === true) {
    await journaliser(req, ref, data.type_document, "trouve", lat, lon);
    return new Response(JSON.stringify(data), { headers: cors, status: 200 });
  }

  // La référence canonique permet de retrouver la consultation quel que soit
  // le mode de saisie (référence imprimée ou jeton QR).
  const refDoc = typeof data.reference === "string" && data.reference ? data.reference : ref;

  // Le vérificateur présente-t-il une consultation déjà payée ?
  if (jetonConsultation) {
    const { data: consultation } = await supabase
      .from("consultations_qr")
      .select("statut, payee_le, reference_document, code")
      .eq("jeton", jetonConsultation)
      .maybeSingle();

    if (consultation && consultation.reference_document === refDoc) {
      const payeeRecemment =
        consultation.statut === "payee" &&
        consultation.payee_le &&
        Date.now() - new Date(consultation.payee_le).getTime() < VALIDITE_PAIEMENT_MS;

      if (payeeRecemment) {
        await journaliser(req, ref, data.type_document, "trouve", lat, lon);
        return new Response(JSON.stringify({ ...data, consultation_payee: true }), {
          headers: cors,
          status: 200,
        });
      }
      if (consultation.statut !== "annulee") {
        // Consultation connue mais pas encore payée : même écran, même jeton.
        await journaliser(req, ref, data.type_document, "paiement_requis", lat, lon);
        return reponsePaiementRequis(refDoc, data.type_document, consultation.code, jetonConsultation, consultation.statut);
      }
    }
  }

  // Nouvelle consultation à payer.
  const jeton = genJeton();
  const code = genCode();
  const { error: insertErr } = await supabase.from("consultations_qr").insert({
    reference_saisie: ref.slice(0, 200),
    reference_document: refDoc,
    type_document: data.type_document,
    code,
    jeton,
    montant_total: TARIF.montant_total,
    part_chefferie: TARIF.part_chefferie,
    commission_sgnf: TARIF.commission_sgnf,
  });
  if (insertErr) {
    console.error("creation consultation:", insertErr);
    await journaliser(req, ref, data.type_document, "erreur", lat, lon);
    return new Response(JSON.stringify({ statut: "erreur" }), { headers: cors, status: 500 });
  }

  await journaliser(req, ref, data.type_document, "paiement_requis", lat, lon);
  return reponsePaiementRequis(refDoc, data.type_document, code, jeton, "en_attente");
});
