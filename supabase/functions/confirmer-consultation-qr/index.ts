// SGFN — Edge Function : WEBHOOK CINETPAY — CONSULTATION QR
// Pendant de confirmer-paiement pour les consultations QR payantes.
// Pas de JWT (appelé par CinetPay directement, déployer avec --no-verify-jwt).
// Sécurité : on revérifie le paiement via l'API CinetPay avant toute mise à jour.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CINETPAY_API_KEY = Deno.env.get("CINETPAY_API_KEY") ?? "";
  const CINETPAY_SITE_ID = Deno.env.get("CINETPAY_SITE_ID") ?? "";

  // CinetPay envoie application/x-www-form-urlencoded ou JSON selon la version
  let cpmTransId: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    cpmTransId = body.cpm_trans_id ?? body.transaction_id ?? null;
  } else {
    const text = await req.text();
    const params = new URLSearchParams(text);
    cpmTransId = params.get("cpm_trans_id") ?? params.get("transaction_id");
  }

  if (!cpmTransId) {
    return new Response("transaction_id manquant", { status: 400 });
  }

  // Vérifier le paiement auprès de CinetPay
  const checkRes = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: cpmTransId,
    }),
  });

  const check = await checkRes.json();

  // code "00" = paiement accepté
  const accepted = check.code === "00" && check.data?.status === "ACCEPTED";
  const failed = check.data?.status === "REFUSED" || check.data?.status === "CANCELLED";

  if (!accepted && !failed) {
    // Statut intermédiaire, on répond 200 sans modifier la DB
    return new Response("statut intermédiaire", { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: consultation } = await admin
    .from("consultations_qr")
    .select("id, statut")
    .eq("reference_externe", `cinetpay:${cpmTransId}`)
    .maybeSingle();

  if (!consultation) {
    return new Response("consultation introuvable", { status: 404 });
  }

  if (consultation.statut === "payee") {
    // Déjà traité — idempotent
    return new Response("déjà traité", { status: 200 });
  }

  const cpmPayId = check.data?.cpm_payid ?? check.data?.cpm_trans_id ?? cpmTransId;

  const { error } = await admin
    .from("consultations_qr")
    .update(
      accepted
        ? { statut: "payee", payee_le: new Date().toISOString(), reference_externe: `cinetpay:${cpmPayId}` }
        : { statut: "echoue", reference_externe: `cinetpay:${cpmPayId}` },
    )
    .eq("id", consultation.id);

  if (error) {
    console.error("mise à jour consultation:", error);
    return new Response("Erreur interne", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
