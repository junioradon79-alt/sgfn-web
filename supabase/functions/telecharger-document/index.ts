// =====================================================================
//  SGFN — Edge Function : TELECHARGER-DOCUMENT
//  Telechargement securise d'un document depuis le bucket prive
//  'documents'. Principe :
//    1) On cree un client Supabase avec le JETON DE L'UTILISATEUR
//       (pas service_role) -> les RLS deja en place s'appliquent.
//    2) On essaie de lire la ligne correspondant a la reference/id
//       demandee. Si RLS bloque -> la ligne n'est pas trouvee -> acces refuse.
//    3) Si la ligne est trouvee (donc l'utilisateur y a legitimement
//       acces), on bascule sur un client service_role UNIQUEMENT pour
//       generer une URL signee temporaire vers le fichier.
//  Aucune logique d'autorisation n'est dupliquee : les politiques RLS
//  existantes restent la seule source de verite.
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Content-Type": "application/json",
};

const CONFIG: Record<string, { refColumn: string; ext: string[] }> = {
  attestations_cession:     { refColumn: "reference", ext: ["pdf", "html"] },
  certificats_vente:        { refColumn: "reference", ext: ["pdf", "html"] },
  attestations_coutumieres: { refColumn: "reference", ext: ["pdf", "html"] },
  paiements:                { refColumn: "reference", ext: ["pdf", "html"] },
  pv_bornage:               { refColumn: "reference", ext: ["pdf", "html"] },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ erreur: "Authentification requise." }), { status: 401, headers: cors });
  }

  let body: { table?: string; reference?: string; variant?: "original" | "apercu" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erreur: "Corps de requete invalide." }), { status: 400, headers: cors });
  }

  const table = body.table ?? "";
  const reference = body.reference ?? "";

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- Cas particulier : table "documents" generique (id, chemin deja connu dans la ligne) ----
  if (table === "documents") {
    if (!reference) {
      return new Response(JSON.stringify({ erreur: "Parametre 'reference' (id) manquant." }), { status: 400, headers: cors });
    }
    const variant = body.variant === "apercu" ? "apercu" : "original";

    const { data: row, error: rowErr } = await callerClient
      .from("documents")
      .select("url_fichier, apercu_url")
      .eq("id", reference)
      .maybeSingle();

    if (rowErr) {
      console.error("Erreur lecture autorisee (documents):", rowErr);
      return new Response(JSON.stringify({ erreur: "Erreur lors de la verification d'acces." }), { status: 500, headers: cors });
    }
    if (!row) {
      return new Response(JSON.stringify({ erreur: "Document introuvable ou acces non autorise." }), { status: 403, headers: cors });
    }

    const chemin = variant === "apercu" ? row.apercu_url : row.url_fichier;
    if (!chemin) {
      return new Response(JSON.stringify({ erreur: "Aucun fichier disponible pour cette variante." }), { status: 404, headers: cors });
    }

    const { data: signed, error: signErr } = await adminClient
      .storage.from("documents")
      .createSignedUrl(chemin, 120);

    if (signErr || !signed?.signedUrl) {
      console.error("Erreur signature URL (documents):", signErr);
      return new Response(JSON.stringify({ erreur: "Le fichier n'a pas pu etre recupere." }), { status: 404, headers: cors });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl, expiresIn: 120 }), { headers: cors });
  }

  // ---- Cas standard : tables avec reference + extensions a essayer ----
  const cfg = CONFIG[table];
  if (!cfg || !reference) {
    return new Response(JSON.stringify({ erreur: "Parametres 'table' ou 'reference' manquants/invalides." }), { status: 400, headers: cors });
  }

  const { data: row, error: rowErr } = await callerClient
    .from(table)
    .select(cfg.refColumn)
    .eq(cfg.refColumn, reference)
    .maybeSingle();

  if (rowErr) {
    console.error("Erreur lecture autorisee:", rowErr);
    return new Response(JSON.stringify({ erreur: "Erreur lors de la verification d'acces." }), { status: 500, headers: cors });
  }
  if (!row) {
    return new Response(JSON.stringify({ erreur: "Document introuvable ou acces non autorise." }), { status: 403, headers: cors });
  }

  for (const ext of cfg.ext) {
    const chemin = `${table}/${reference}.${ext}`;
    const { data: signed, error: signErr } = await adminClient
      .storage.from("documents")
      .createSignedUrl(chemin, 120);

    if (!signErr && signed?.signedUrl) {
      return new Response(JSON.stringify({
        url: signed.signedUrl,
        format: ext,
        expiresIn: 120,
        reference,
      }), { headers: cors });
    }
  }

  return new Response(JSON.stringify({ erreur: "Le fichier n'a pas encore ete genere pour ce document." }), { status: 404, headers: cors });
});
