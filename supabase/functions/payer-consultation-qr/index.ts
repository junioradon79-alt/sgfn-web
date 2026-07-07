// SGFN — Edge Function : PAYER UNE CONSULTATION QR (attestation de cession)
// Initie le paiement CinetPay d'une consultation créée par verification-qr.
// Appelée anonymement depuis /verifier (déployer avec --no-verify-jwt) : le
// jeton de consultation fait office de secret porteur.
// Tant que les secrets CinetPay ne sont pas posés, répond 503 — le front
// affiche alors la marche à suivre pour un paiement manuel (code CQR-…).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // TODO: remplacer l'intégration CinetPay ci-dessous par le fournisseur définitif une fois choisi
  const CINETPAY_API_KEY = Deno.env.get("CINETPAY_API_KEY") ?? "";
  const CINETPAY_SITE_ID = Deno.env.get("CINETPAY_SITE_ID") ?? "";

  let jeton: string;
  try {
    const body = await req.json();
    jeton = body.jeton_consultation;
    if (!jeton || typeof jeton !== "string") throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "jeton_consultation requis" }), {
      status: 400,
      headers: CORS,
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: consultation, error: fetchErr } = await admin
    .from("consultations_qr")
    .select("id, reference_document, montant_total, statut")
    .eq("jeton", jeton)
    .maybeSingle();

  if (fetchErr || !consultation) {
    return new Response(JSON.stringify({ error: "Consultation introuvable" }), {
      status: 404,
      headers: CORS,
    });
  }

  if (consultation.statut === "payee") {
    return new Response(JSON.stringify({ error: "Cette consultation est déjà payée" }), {
      status: 400,
      headers: CORS,
    });
  }
  if (consultation.statut === "annulee") {
    return new Response(JSON.stringify({ error: "Cette consultation a été annulée" }), {
      status: 400,
      headers: CORS,
    });
  }

  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    return new Response(
      JSON.stringify({ error: "Agrégateur de paiement non configuré" }),
      { status: 503, headers: CORS },
    );
  }

  // Montant multiple de 5 (exigence CinetPay XOF)
  const montant = Math.max(100, Math.round((consultation.montant_total ?? 0) / 5) * 5);

  // transaction_id unique : uuid sans tirets + timestamp base36
  const txId = `${consultation.id.replace(/-/g, "").slice(0, 20)}-${Date.now().toString(36)}`;

  await admin
    .from("consultations_qr")
    .update({ reference_externe: `cinetpay:${txId}`, statut: "initie" })
    .eq("id", consultation.id);

  const retour = `https://sgfn.ci/verifier?ref=${encodeURIComponent(consultation.reference_document)}&consultation=${encodeURIComponent(jeton)}`;

  const cpRes = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: txId,
      amount: montant,
      currency: "XOF",
      description: `Consultation QR — ${consultation.reference_document}`,
      return_url: retour,
      notify_url: `${SUPABASE_URL}/functions/v1/confirmer-consultation-qr`,
      customer_name: "Vérificateur SGNF",
      channels: "ALL",
    }),
  });

  const cpData = await cpRes.json();

  if (cpData.code !== "201") {
    return new Response(
      JSON.stringify({ error: cpData.message ?? "Erreur CinetPay" }),
      { status: 502, headers: CORS },
    );
  }

  return new Response(
    JSON.stringify({ payment_url: cpData.data.payment_url, transaction_id: txId }),
    { status: 200, headers: CORS },
  );
});
