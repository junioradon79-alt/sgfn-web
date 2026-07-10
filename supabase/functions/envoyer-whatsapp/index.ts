// =====================================================================
//  SGNF — Edge Function : ENVOYER-WHATSAPP  (v1)
//  Envoie une notification (table `notifications`) via WhatsApp Cloud API (Meta).
//
//  INERTE tant que les secrets Meta ne sont pas posés : sans WHATSAPP_TOKEN /
//  WHATSAPP_PHONE_NUMBER_ID, la fonction renvoie 503 et laisse la notification
//  `en_attente` (rien n'est perdu). Aligné sur le modèle des autres edges :
//  garde d'auth fail-closed (service_role OU x-hook-secret).
//
//  Règle de routage : chaque notification vise UN profil (destinataire_profile_id)
//  → on lit son numéro dans profiles.telephone. Pas de numéro central.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const HOOK_SECRET = Deno.env.get("HOOK_SECRET");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v21.0";
const TEMPLATE_LANG = Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "fr";
const DEFAULT_CC = Deno.env.get("WHATSAPP_DEFAULT_CC") ?? "225"; // Côte d'Ivoire
// Noms de modèles (surchargables pour coller aux templates approuvés par Meta).
const TPL_AGENCE = Deno.env.get("WHATSAPP_TPL_AGENCE") ?? "sgnf_action_agence";
const TPL_ACQUEREUR = Deno.env.get("WHATSAPP_TPL_ACQUEREUR") ?? "sgnf_acquereur_etape";

// Mappe le type de notification → modèle + paramètres positionnels {{1}},{{2}},{{3}}.
function construireModele(type: string, params: Record<string, string>): { name: string; body: string[] } | null {
  if (type.startsWith("agence_")) {
    return { name: TPL_AGENCE, body: [params.action ?? "Action à traiter", params.lot ?? "—", params.lieu ?? "—"] };
  }
  if (type.startsWith("acquereur_")) {
    return { name: TPL_ACQUEREUR, body: [params.etape ?? "Mise à jour", params.lot ?? "—", params.complement ?? ""] };
  }
  return null;
}

// Normalise un numéro CI vers le format international (chiffres uniquement).
function normaliserNumero(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(DEFAULT_CC)) return d;
  if (d.length >= 8 && d.length <= 10) return DEFAULT_CC + d; // numéro local
  return d.length >= 8 ? d : null;
}

function roleDuJwt(req: Request): string | null {
  const m = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const seg = m[1].split(".")[1];
  if (!seg) return null;
  try {
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

async function marquer(id: string, statut: string, erreur?: string) {
  await supabase.from("notifications").update({
    statut,
    erreur: erreur ?? null,
    envoye_le: statut === "envoye" ? new Date().toISOString() : null,
  }).eq("id", id);
}

Deno.serve(async (req) => {
  // Garde d'auth fail-closed (comme generation-document).
  const secretOk = HOOK_SECRET ? req.headers.get("x-hook-secret") === HOOK_SECRET : false;
  if (!secretOk && roleDuJwt(req) !== "service_role") {
    return new Response("Non autorisé", { status: 401 });
  }

  const evt = await req.json().catch(() => ({}));

  // Mode diagnostic : indique si la configuration Meta est prête.
  if (evt.debug === true) {
    return Response.json({
      configure: !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
      hasToken: !!WHATSAPP_TOKEN,
      hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
      templates: { agence: TPL_AGENCE, acquereur: TPL_ACQUEREUR, langue: TEMPLATE_LANG },
    });
  }

  // Agrégateur non configuré → 503, la notification reste en_attente.
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(JSON.stringify({ error: "WhatsApp non configuré" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const notificationId = evt.notification_id;
  if (!notificationId) {
    return new Response(JSON.stringify({ error: "notification_id manquant" }), { status: 400 });
  }

  const { data: notif } = await supabase
    .from("notifications")
    .select("id, destinataire_profile_id, type, params, statut, canal")
    .eq("id", notificationId)
    .single();

  if (!notif) return Response.json({ ok: false, raison: "introuvable" });
  if (notif.canal !== "whatsapp") return Response.json({ ok: false, raison: "canal non whatsapp" });
  if (notif.statut !== "en_attente") return Response.json({ ok: true, raison: "déjà traité" });

  // Numéro du destinataire.
  const { data: prof } = await supabase
    .from("profiles")
    .select("telephone")
    .eq("id", notif.destinataire_profile_id)
    .single();
  const numero = normaliserNumero(prof?.telephone);
  if (!numero) {
    await marquer(notif.id, "ignore", "Aucun numéro de téléphone valide pour ce profil.");
    return Response.json({ ok: false, raison: "sans_numero" });
  }

  const modele = construireModele(notif.type, (notif.params ?? {}) as Record<string, string>);
  if (!modele) {
    await marquer(notif.id, "ignore", `Type de notification non mappé: ${notif.type}`);
    return Response.json({ ok: false, raison: "type_non_mappe" });
  }

  // Appel Meta Cloud API.
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: modele.name,
      language: { code: TEMPLATE_LANG },
      components: [
        { type: "body", parameters: modele.body.map((t) => ({ type: "text", text: t })) },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      await marquer(notif.id, "echoue", `Meta ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      return Response.json({ ok: false, statut: res.status, meta: json });
    }
    await marquer(notif.id, "envoye");
    return Response.json({ ok: true, wa_id: json?.messages?.[0]?.id ?? null });
  } catch (e) {
    await marquer(notif.id, "echoue", `Exception: ${String(e).slice(0, 500)}`);
    return Response.json({ ok: false, erreur: String(e) });
  }
});
