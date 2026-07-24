// =====================================================================
//  SGFN — Edge Function : CONVERTIR-PLAN-CAD
//  Convertit un plan DXF (deja televerse dans le bucket prive
//  'documents', chemin stocke dans documents.url_fichier) en un apercu
//  SVG via un parseur/moteur de rendu DXF internes (aucun service
//  externe). Remplace l'ancienne integration CloudConvert (DWG->PNG),
//  abandonnee car DWG est un format binaire proprietaire non documente
//  et produisait des apercus blancs sur des fichiers reels.
//  Principe d'acces identique a telecharger-document : verification via
//  le jeton de l'appelant (RLS), puis bascule service_role pour lire/
//  ecrire dans le storage et mettre a jour la ligne.
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

function reponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

// ─────────────────────────────────────────────────────────────────────
//  PARSEUR DXF
//  Format ASCII DXF : paires de lignes (code numerique / valeur).
//  On ne traite que la section ENTITIES, et seulement les types
//  d'entites utiles a un apercu 2D de plan (lignes, polylignes,
//  cercles, arcs, textes). Tout type non supporte (INSERT/blocs,
//  HATCH, DIMENSION, SPLINE, ELLIPSE...) est silencieusement ignore
//  (jamais d'exception qui ferait echouer tout le fichier).
// ─────────────────────────────────────────────────────────────────────

type DxfPoint = { x: number; y: number };

type DxfEntity =
  | { kind: "line"; a: DxfPoint; b: DxfPoint }
  | { kind: "circle"; center: DxfPoint; radius: number }
  | { kind: "arc"; center: DxfPoint; radius: number; startAngleDeg: number; endAngleDeg: number }
  | { kind: "polyline"; closed: boolean; vertices: DxfPoint[] }
  | { kind: "text"; position: DxfPoint; height: number; content: string };

type DxfToken = { code: number; value: string };

function tokenizeDxf(text: string): DxfToken[] {
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim());
  const tokens: DxfToken[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i], 10);
    const value = lines[i + 1];
    if (Number.isNaN(code) || value === undefined) break;
    tokens.push({ code, value });
  }
  return tokens;
}

function parseDxf(text: string): { entities: DxfEntity[]; skipped: string[] } {
  const tokens = tokenizeDxf(text);
  const entities: DxfEntity[] = [];
  const skipped = new Set<string>();

  let inEntities = false;
  let i = 0;

  function readEntityBlock(): DxfToken[] {
    const group: DxfToken[] = [];
    i++;
    while (i < tokens.length && tokens[i].code !== 0) {
      group.push(tokens[i]);
      i++;
    }
    return group;
  }

  function get(group: DxfToken[], code: number): string | undefined {
    return group.find((g) => g.code === code)?.value;
  }
  function num(group: DxfToken[], code: number, fallback = 0): number {
    const v = get(group, code);
    return v === undefined ? fallback : parseFloat(v);
  }

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok.code === 0 && tok.value === "SECTION") {
      const nameTok = tokens[i + 1];
      inEntities = !!nameTok && nameTok.code === 2 && nameTok.value === "ENTITIES";
      i += 2;
      continue;
    }
    if (tok.code === 0 && tok.value === "ENDSEC") {
      inEntities = false;
      i++;
      continue;
    }
    if (tok.code === 0 && tok.value === "EOF") break;
    if (!inEntities) {
      i++;
      continue;
    }
    if (tok.code !== 0) {
      i++;
      continue;
    }

    try {
      if (tok.value === "LINE") {
        const g = readEntityBlock();
        entities.push({
          kind: "line",
          a: { x: num(g, 10), y: num(g, 20) },
          b: { x: num(g, 11), y: num(g, 21) },
        });
      } else if (tok.value === "CIRCLE") {
        const g = readEntityBlock();
        entities.push({ kind: "circle", center: { x: num(g, 10), y: num(g, 20) }, radius: num(g, 40) });
      } else if (tok.value === "ARC") {
        const g = readEntityBlock();
        entities.push({
          kind: "arc",
          center: { x: num(g, 10), y: num(g, 20) },
          radius: num(g, 40),
          startAngleDeg: num(g, 50),
          endAngleDeg: num(g, 51),
        });
      } else if (tok.value === "LWPOLYLINE") {
        const g = readEntityBlock();
        const closed = (parseInt(get(g, 70) ?? "0", 10) & 1) === 1;
        // Les sommets sont des groupes 10/20 repetes : un nouveau code 10 demarre un sommet.
        // NB v1 : le bulge (code 42, segments courbes) n'est pas interprete — chaque segment
        // est trace en ligne droite (TODO v2 : fidelite des arcs de polyligne si necessaire).
        const vertices: DxfPoint[] = [];
        let current: DxfPoint | null = null;
        for (const t of g) {
          if (t.code === 10) {
            if (current) vertices.push(current);
            current = { x: parseFloat(t.value), y: 0 };
          } else if (t.code === 20 && current) {
            current.y = parseFloat(t.value);
          }
        }
        if (current) vertices.push(current);
        entities.push({ kind: "polyline", closed, vertices });
      } else if (tok.value === "POLYLINE") {
        // Forme heritee : sommets en sous-entites separees VERTEX...SEQEND.
        const g = readEntityBlock();
        const closed = (parseInt(get(g, 70) ?? "0", 10) & 1) === 1;
        const vertices: DxfPoint[] = [];
        while (i < tokens.length && !(tokens[i].code === 0 && tokens[i].value === "SEQEND")) {
          if (tokens[i].code === 0 && tokens[i].value === "VERTEX") {
            const vg = readEntityBlock();
            vertices.push({ x: num(vg, 10), y: num(vg, 20) });
          } else {
            i++;
          }
        }
        if (i < tokens.length && tokens[i].code === 0 && tokens[i].value === "SEQEND") i++;
        entities.push({ kind: "polyline", closed, vertices });
        continue;
      } else if (tok.value === "TEXT") {
        const g = readEntityBlock();
        entities.push({
          kind: "text",
          position: { x: num(g, 10), y: num(g, 20) },
          height: num(g, 40, 2.5),
          content: get(g, 1) ?? "",
        });
      } else if (tok.value === "MTEXT") {
        const g = readEntityBlock();
        const chunks = g.filter((t) => t.code === 3).map((t) => t.value);
        const finalChunk = get(g, 1) ?? "";
        let content = chunks.join("") + finalChunk;
        // Best-effort : on retire les codes de formatage MTEXT sans les interpreter.
        content = content.replace(/\\P/g, " ").replace(/[{}]/g, "").replace(/\\[A-Za-z][^;]*;/g, "");
        entities.push({ kind: "text", position: { x: num(g, 10), y: num(g, 20) }, height: num(g, 40, 2.5), content });
      } else {
        // Type non supporte en v1 (INSERT/blocs, HATCH, DIMENSION, SPLINE, ELLIPSE...).
        skipped.add(tok.value);
        readEntityBlock();
      }
    } catch (err) {
      // Une entite malformee ne doit jamais faire echouer tout le fichier.
      console.warn("Entite DXF ignoree (erreur de parsing):", tok.value, err);
      skipped.add(`${tok.value}(erreur)`);
      i++;
    }
  }

  return { entities, skipped: Array.from(skipped) };
}

// ─────────────────────────────────────────────────────────────────────
//  RENDU SVG
// ─────────────────────────────────────────────────────────────────────

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function computeBounds(entities: DxfEntity[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const feed = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.kind === "line") { feed(e.a.x, e.a.y); feed(e.b.x, e.b.y); }
    else if (e.kind === "circle") { feed(e.center.x - e.radius, e.center.y - e.radius); feed(e.center.x + e.radius, e.center.y + e.radius); }
    else if (e.kind === "arc") { feed(e.center.x - e.radius, e.center.y - e.radius); feed(e.center.x + e.radius, e.center.y + e.radius); }
    else if (e.kind === "polyline") { for (const v of e.vertices) feed(v.x, v.y); }
    else if (e.kind === "text") { feed(e.position.x, e.position.y); }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  if (maxX - minX < 1e-9) maxX = minX + 100;
  if (maxY - minY < 1e-9) maxY = minY + 100;
  return { minX, minY, maxX, maxY };
}

function makeTransform(bounds: Bounds, paddingRatio = 0.05) {
  const boxW = bounds.maxX - bounds.minX;
  const boxH = bounds.maxY - bounds.minY;
  const pad = Math.max(boxW, boxH) * paddingRatio;
  const paddedMinX = bounds.minX - pad;
  const paddedMinY = bounds.minY - pad;
  const paddedW = boxW + 2 * pad;
  const paddedH = boxH + 2 * pad;
  // DXF : axe Y vers le haut. SVG : axe Y vers le bas -> inversion explicite par point
  // (plutot qu'un <g transform="scale(1,-1)"> global, qui inverserait aussi le texte).
  const worldToSvg = (p: DxfPoint): DxfPoint => ({
    x: p.x - paddedMinX,
    y: paddedH - (p.y - paddedMinY),
  });
  return { worldToSvg, paddedW, paddedH };
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "0");
const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderEntity(
  e: DxfEntity,
  worldToSvg: (p: DxfPoint) => DxfPoint,
  strokeWidth: number,
  strokeColor: string,
): string {
  if (e.kind === "line") {
    const a = worldToSvg(e.a), b = worldToSvg(e.b);
    return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" />`;
  }
  if (e.kind === "circle") {
    const c = worldToSvg(e.center);
    return `<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="${fmt(e.radius)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "arc") {
    const startRad = (e.startAngleDeg * Math.PI) / 180;
    const endRad = (e.endAngleDeg * Math.PI) / 180;
    const startPtWorld = { x: e.center.x + e.radius * Math.cos(startRad), y: e.center.y + e.radius * Math.sin(startRad) };
    const endPtWorld = { x: e.center.x + e.radius * Math.cos(endRad), y: e.center.y + e.radius * Math.sin(endRad) };
    let sweptDeg = (e.endAngleDeg - e.startAngleDeg) % 360;
    if (sweptDeg < 0) sweptDeg += 360;
    const largeArcFlag = sweptDeg > 180 ? 1 : 0;
    // DXF balaie en sens trigonometrique (CCW). L'inversion Y (miroir) inverse le
    // sens visuel apparent -> sweep-flag force a 0 pour compenser (verifie
    // mathematiquement sur un cas de test avant deploiement).
    const sweepFlag = 0;
    const s = worldToSvg(startPtWorld), en = worldToSvg(endPtWorld);
    return `<path d="M ${fmt(s.x)} ${fmt(s.y)} A ${fmt(e.radius)} ${fmt(e.radius)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(en.x)} ${fmt(en.y)}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "polyline") {
    if (e.vertices.length === 0) return "";
    const pts = e.vertices.map(worldToSvg);
    let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    for (let k = 1; k < pts.length; k++) d += ` L ${fmt(pts[k].x)} ${fmt(pts[k].y)}`;
    if (e.closed) d += " Z";
    return `<path d="${d}" stroke="${strokeColor}" stroke-width="${fmt(strokeWidth)}" fill="none" />`;
  }
  if (e.kind === "text") {
    const p = worldToSvg(e.position);
    const size = e.height > 0 ? e.height : 2.5;
    return `<text x="${fmt(p.x)}" y="${fmt(p.y)}" font-size="${fmt(size)}" fill="${strokeColor}">${escapeXml(e.content)}</text>`;
  }
  return "";
}

function renderSvg(entities: DxfEntity[]): string {
  const bounds = computeBounds(entities);
  const { worldToSvg, paddedW, paddedH } = makeTransform(bounds);
  // Epaisseur de trait relative a la taille du dessin : l'unite DXF (m, mm, sans
  // unite...) n'est pas fiable a lire, un trait absolu serait invisible ou enorme
  // selon l'echelle du plan source.
  const strokeWidth = Math.max(paddedW, paddedH) * 0.0025;
  const strokeColor = "#0D3B66";
  const body = entities.map((e) => renderEntity(e, worldToSvg, strokeWidth, strokeColor)).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(paddedW)} ${fmt(paddedH)}" preserveAspectRatio="xMidYMid meet">\n  <rect x="0" y="0" width="${fmt(paddedW)}" height="${fmt(paddedH)}" fill="#ffffff" />\n  ${body}\n</svg>`;
}

// ─────────────────────────────────────────────────────────────────────
//  HANDLER
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return reponse({ ok: false, erreur: "Authentification requise." }, 401);
  }

  let body: { document_id?: string };
  try {
    body = await req.json();
  } catch {
    return reponse({ ok: false, erreur: "Corps de requete invalide." }, 400);
  }

  const documentId = body.document_id ?? "";
  if (!documentId) {
    return reponse({ ok: false, erreur: "Parametre 'document_id' manquant." }, 400);
  }

  // ---- Etape 1 : verification d'acces via le jeton de l'appelant (RLS) ----
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: docRow, error: docErr } = await callerClient
    .from("documents")
    .select("id, url_fichier")
    .eq("id", documentId)
    .maybeSingle();

  if (docErr) {
    console.error("Erreur lecture autorisee:", docErr);
    return reponse({ ok: false, erreur: "Erreur lors de la verification d'acces." }, 500);
  }
  if (!docRow) {
    return reponse({ ok: false, erreur: "Document introuvable ou acces non autorise." }, 403);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // ---- Etape 2 : lecture directe du fichier original (bucket prive, service_role) ----
    const { data: fileBlob, error: downloadErr } = await adminClient
      .storage.from("documents")
      .download(docRow.url_fichier);

    if (downloadErr || !fileBlob) {
      console.error("Erreur telechargement original:", downloadErr);
      return reponse({ ok: false, erreur: "Impossible de lire le fichier original." }, 500);
    }

    // ---- Etape 3 : parsing DXF (texte ASCII) ----
    const dxfText = await fileBlob.text();
    const { entities, skipped } = parseDxf(dxfText);

    if (skipped.length > 0) {
      console.log(`Plan ${documentId} — types DXF ignores:`, skipped.join(", "));
    }

    if (entities.length === 0) {
      return reponse(
        {
          ok: false,
          erreur: "Aucun element pris en charge n'a ete trouve dans ce plan (blocs/references externes non supportes en v1).",
        },
        422,
      );
    }

    // ---- Etape 4 : rendu SVG ----
    const svgString = renderSvg(entities);

    // ---- Etape 5 : upload de l'apercu ----
    const cheminApercu = `plans-cad/${documentId}/apercu.svg`;
    const { error: uploadErr } = await adminClient
      .storage.from("documents")
      .upload(cheminApercu, new TextEncoder().encode(svgString), { contentType: "image/svg+xml", upsert: true });

    if (uploadErr) {
      console.error("Erreur upload apercu:", uploadErr);
      return reponse({ ok: false, erreur: "Echec de l'enregistrement de l'apercu." }, 500);
    }

    // ---- Etape 6 : mise a jour de la ligne documents ----
    const { error: updateErr } = await adminClient
      .from("documents")
      .update({ apercu_url: cheminApercu })
      .eq("id", documentId);

    if (updateErr) {
      console.error("Erreur mise a jour documents.apercu_url:", updateErr);
      return reponse({ ok: false, erreur: "Apercu genere mais non enregistre." }, 500);
    }

    return reponse({ ok: true, apercu_url: cheminApercu });
  } catch (err) {
    console.error("Erreur inattendue conversion plan CAD:", err);
    return reponse({ ok: false, erreur: "Erreur inattendue lors de la conversion." }, 500);
  }
});
