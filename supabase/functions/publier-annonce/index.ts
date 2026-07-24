import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =====================================================================
//  Mon Terrain — publier-annonce  (JWT requis)
//  Module « Mettre en vente » : un propriétaire publie / met à jour
//  l'annonce d'un lot qu'il détient (attestation ou certificat délivré
//  à son nom). 1 annonce par lot (upsert sur lot_id). Enregistre aussi
//  les coordonnées GPS exactes du lot (privées) si fournies.
// =====================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUTS = ["brouillon", "active", "suspendue", "vendue"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non autorisé" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Non autorisé" }, 401);

  let lot_id: string, titre: string, description: string | null;
  let prix: number, usage: string | null, zone: string | null, statut: string;
  let latitude: number | null, longitude: number | null;
  try {
    const b = await req.json();
    lot_id = (b.lot_id ?? "").toString().trim();
    titre = (b.titre ?? "").toString().trim();
    description = b.description ? b.description.toString() : null;
    prix = Number(b.prix);
    usage = b.usage ? b.usage.toString().trim() : null;
    zone = b.zone ? b.zone.toString().trim() : null;
    statut = (b.statut ?? "active").toString();
    latitude = b.latitude === null || b.latitude === undefined ? null : Number(b.latitude);
    longitude = b.longitude === null || b.longitude === undefined ? null : Number(b.longitude);
    if (!lot_id || !titre || !Number.isFinite(prix) || prix < 0) throw new Error();
    if (!STATUTS.includes(statut)) statut = "active";
    // Validation géo : bornes plausibles (Côte d'Ivoire ~ lat 4–11, lng -9–-2) mais on reste large.
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw new Error();
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw new Error();
  } catch {
    return json({ error: "lot_id, titre et prix (>=0) requis ; coordonnées invalides" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Profil + attributaire du demandeur
  const { data: profile } = await admin
    .from("profiles")
    .select("id, attributaire_id")
    .eq("id", user.id)
    .single();

  if (!profile?.attributaire_id) {
    return json({ error: "Votre compte n'est lié à aucun attributaire." }, 403);
  }

  // Le lot doit avoir un document délivré au nom de cet attributaire
  const [{ data: att }, { data: cert }, { data: lot }] = await Promise.all([
    admin.from("attestations_cession").select("id").eq("lot_id", lot_id)
      .eq("statut", "delivree").eq("acquereur_id", profile.attributaire_id).maybeSingle(),
    admin.from("certificats_vente").select("id").eq("lot_id", lot_id)
      .eq("statut", "delivree").eq("acquereur_id", profile.attributaire_id).maybeSingle(),
    admin.from("lots").select("id, superficie_m2").eq("id", lot_id).single(),
  ]);

  if (!lot) return json({ error: "Lot introuvable" }, 404);
  if (!att && !cert) {
    return json({ error: "Vous n'êtes pas le propriétaire enregistré de ce lot." }, 403);
  }

  // Enregistrer les coordonnées exactes (privées) sur le lot si fournies
  if (latitude !== null && longitude !== null) {
    const { error: geoErr } = await admin
      .from("lots")
      .update({ latitude, longitude })
      .eq("id", lot_id);
    if (geoErr) console.error("maj coordonnées lot", geoErr);
  }

  const now = new Date().toISOString();
  const row = {
    lot_id,
    proprietaire_profile_id: profile.id,
    titre,
    description,
    prix,
    usage,
    zone,
    superficie_m2: lot.superficie_m2,
    statut,
    publiee_le: statut === "active" ? now : null,
  };

  const { data: annonce, error: upErr } = await admin
    .from("annonces_marketplace")
    .upsert(row, { onConflict: "lot_id" })
    .select("id, statut, publiee_le")
    .single();

  if (upErr) {
    console.error("upsert annonce", upErr);
    return json({ error: "Publication impossible" }, 500);
  }

  return json({ ok: true, annonce });
});
