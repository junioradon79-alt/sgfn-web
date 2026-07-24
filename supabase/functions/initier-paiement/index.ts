import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  // x-client-info / apikey sont envoyés d'office par le client supabase-js
  // (functions.invoke) : sans eux dans la liste, le préflight CORS échoue avant
  // d'atteindre la fonction (cf. correctif CORS du 11/07 sur les autres edges).
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

const TYPE_LABELS: Record<string, string> = {
  attestation_cession: "Attestation de cession",
  honoraires: "Honoraires géomètre",
  vente_terrain: "Vente terrain",
  autre: "Paiement SGNF",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  // TODO: remplacer l'intégration CinetPay ci-dessous par le fournisseur définitif une fois choisi
  const CINETPAY_API_KEY = Deno.env.get("CINETPAY_API_KEY") ?? "";
  const CINETPAY_SITE_ID = Deno.env.get("CINETPAY_SITE_ID") ?? "";

  // Vérifier l'utilisateur
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let paiement_id: string;
  try {
    const body = await req.json();
    paiement_id = body.paiement_id;
    if (!paiement_id) throw new Error();
  } catch {
    return new Response(JSON.stringify({ error: "paiement_id requis" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Récupérer le paiement
  const { data: paiement, error: fetchErr } = await admin
    .from("paiements")
    .select("id, type, montant_total, statut, beneficiaire, acquereur_id")
    .eq("id", paiement_id)
    .single();

  if (fetchErr || !paiement) {
    return new Response(JSON.stringify({ error: "Paiement introuvable" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (paiement.statut !== "en_attente") {
    return new Response(
      JSON.stringify({ error: "Ce paiement n'est plus en attente" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Contrôle de propriété (correctif audit 24/07) : le paiement est récupéré via
  // service_role (RLS contournée) ; on vérifie donc explicitement que l'appelant
  // a le droit d'initier CE paiement. Autorisés : le titulaire du paiement
  // (acquereur_id = son attributaire — parcours "mon-achat"/"proprietaire"), ou
  // un agent SGNF admin/opérateur agissant au guichet (écran "paiements").
  const { data: profilAppelant } = await admin
    .from("profiles")
    .select("groupe, attributaire_id")
    .eq("id", user.id)
    .single();
  const estAgent = profilAppelant?.groupe === "admin" || profilAppelant?.groupe === "operateur";
  const estTitulaire = paiement.acquereur_id != null
    && profilAppelant?.attributaire_id === paiement.acquereur_id;
  if (!estAgent && !estTitulaire) {
    return new Response(
      JSON.stringify({ error: "Non autorisé pour ce paiement" }),
      { status: 403, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
    return new Response(
      JSON.stringify({ error: "Agrégateur de paiement non configuré" }),
      { status: 503, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Montant multiple de 5 (exigence CinetPay XOF)
  const montant = Math.max(100, Math.round((paiement.montant_total ?? 0) / 5) * 5);
  const description = TYPE_LABELS[paiement.type] ?? "Paiement SGNF";

  // transaction_id unique : uuid sans tirets + timestamp base36
  const txId = `${paiement.id.replace(/-/g, "").slice(0, 20)}-${Date.now().toString(36)}`;

  // Stocker la référence en cours et marquer le paiement comme initié auprès de l'agrégateur
  await admin
    .from("paiements")
    .update({ reference_externe: `cinetpay:${txId}`, statut: "initie" })
    .eq("id", paiement_id);

  // Appel CinetPay
  const cpRes = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: CINETPAY_API_KEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: txId,
      amount: montant,
      currency: "XOF",
      description,
      return_url: "https://sgfn.ci/dashboard/paiements/retour",
      notify_url: `${SUPABASE_URL}/functions/v1/confirmer-paiement`,
      customer_name: paiement.beneficiaire ?? "Client SGNF",
      channels: "ALL",
    }),
  });

  const cpData = await cpRes.json();

  if (cpData.code !== "201") {
    return new Response(
      JSON.stringify({ error: cpData.message ?? "Erreur CinetPay" }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      payment_url: cpData.data.payment_url,
      transaction_id: txId,
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
