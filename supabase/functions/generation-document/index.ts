// =====================================================================
//  SGNF — Edge Function : GENERATION-DOCUMENT  (v35 : gabarit reel Attestation d'Attribution de Lot — chef de village + arrete de nomination, admin temporaire de creation du template PDFMonkey)
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "npm:qrcode";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");
const GOTENBERG_URL  = Deno.env.get("GOTENBERG_URL");
const GOTENBERG_USER = Deno.env.get("GOTENBERG_USER");
const GOTENBERG_PASS = Deno.env.get("GOTENBERG_PASS");
const PUBLIC_VERIFY_BASE = Deno.env.get("PUBLIC_VERIFY_BASE");
const HOOK_SECRET    = Deno.env.get("HOOK_SECRET");

const CONFIG: Record<string, { titre: string; type_doc: string; template: string; pdfmonkeyEnv: string; pdfmonkeyTemplateIdDefault?: string; flipStatutDelivree: boolean; brandColor?: string }> = {
  attestations_cession:     { titre: "ATTESTATION DE CESSION",                       type_doc: "attestation_cession",            template: "attestation_cession.html", pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_ATTESTATION_CESSION", flipStatutDelivree: false, brandColor: "#20406B" },
  // Document unique par lot (Niveau 2/3, 23/07/2026) : mis a jour en place a
  // chaque transfert -> ce meme handler regenere le PDF sur INSERT (1re fois)
  // ET sur UPDATE (transitions Niveau 3, appelees explicitement par
  // _maj_attribution_lot_niveau3()/revoquer_attestation_attribution_lot()).
  // pdfmonkeyTemplateIdDefault : template "ATTESTATION_ATTRIBUTION_LOT" créé via l'API PDFMonkey le
  // 24/07/2026 (même patron que QUITTANCE le 03/07) — pas de secret PDFMONKEY_TEMPLATE_ID_ATTESTATION_ATTRIBUTION posé.
  attestations_attribution_lot: { titre: "ATTESTATION D'ATTRIBUTION DE LOT",         type_doc: "attestation_attribution",         template: "attestation_attribution_lot.html", pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_ATTESTATION_ATTRIBUTION", pdfmonkeyTemplateIdDefault: "a5376606-e3c3-49b2-99af-84368933ac40", flipStatutDelivree: false, brandColor: "#5B3A29" },
  certificats_vente:        { titre: "CERTIFICAT DE VENTE",                          type_doc: "certificat_vente",               template: "certificat_vente.html",     pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_CERTIFICAT_VENTE", flipStatutDelivree: true, brandColor: "#0E6B57" },
  attestations_coutumieres: { titre: "ATTESTATION DE PROPRIETE FONCIERE COUTUMIERE", type_doc: "certificat_propriete_coutumiere", template: "apfc.html",               pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_APFC", flipStatutDelivree: true, brandColor: "#9C362A" },
  // pdfmonkeyTemplateIdDefault : template "QUITTANCE" créé via l'API PDFMonkey le 03/07/2026 (pas de secret
  // PDFMONKEY_TEMPLATE_ID_QUITTANCE posé) — un secret du même nom, s'il est ajouté plus tard, prend le dessus.
  paiements:                { titre: "QUITTANCE DE PAIEMENT",                       type_doc: "quittance",                      template: "quittance.html",           pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_QUITTANCE", pdfmonkeyTemplateIdDefault: "ea7baf50-0341-4ccb-be53-4e2701b7e87d", flipStatutDelivree: false },
  // Pas de gabarit PDFMonkey configure pour l'instant -> repli HTML/Gotenberg (cf. QUITTANCE_GABARIT/PV_BORNAGE_GABARIT).
  pv_bornage:                { titre: "PROCES-VERBAL DE BORNAGE",                    type_doc: "pv_bornage",                     template: "pv_bornage.html",          pdfmonkeyEnv: "PDFMONKEY_TEMPLATE_ID_PV_BORNAGE", flipStatutDelivree: false },
};

const TYPE_PAIEMENT_LABELS: Record<string, string> = {
  attestation_cession: "Attestation de cession",
  honoraires: "Honoraires geometre",
  vente_terrain: "Vente terrain",
  autre: "Paiement SGNF",
};
const MOYEN_LABELS: Record<string, string> = {
  wave: "Wave", orange_money: "Orange Money", mtn_money: "MTN Money", moov_money: "Moov Money",
  virement: "Virement bancaire", especes: "Especes", autre: "Autre",
};
const TYPE_MISSION_LABELS: Record<string, string> = {
  bornage: "Bornage", morcellement: "Morcellement", implantation: "Implantation",
  expertise_judiciaire: "Expertise judiciaire", leve_topographique: "Leve topographique",
  immatriculation: "Immatriculation", copropriete: "Copropriete", autre: "Autre",
};

const MOIS = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
function dateFr(d?: string): string {
  const dt = d ? new Date(d) : new Date();
  return `${dt.getDate()} ${MOIS[dt.getMonth()]} ${dt.getFullYear()}`;
}
function montantFr(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}
function superficieFr(n?: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " m²";
}

async function chargerGabarit(nom: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("templates").download(nom);
    if (data) return await data.text();
  } catch (_) {}
  return null;
}

async function chargerAttributaire(id: string) {
  const { data: att } = await supabase.from("attributaires")
    .select("nom,piece_nature,piece_num,telephone,email").eq("id", id).single();
  return {
    nom: att?.nom ?? "—",
    type_piece: att?.piece_nature ?? "—",
    num_piece: att?.piece_num ?? "—",
    contacts: [att?.telephone, att?.email].filter(Boolean).join(" / ") || "—",
  };
}

async function chargerLot(id: string) {
  const { data: lot } = await supabase.from("lots")
    .select("numero_lot, superficie_m2, ilots(numero, lotissements(nom, village, commune))").eq("id", id).single();
  const il: any = (lot as any)?.ilots; const lo: any = il?.lotissements;
  return {
    lot: lot?.numero_lot ?? "—", ilot: il?.numero ?? "—",
    lotissement: lo?.nom ?? "—", village: lo?.village ?? "—", commune: lo?.commune ?? "—",
    superficie_enregistree: superficieFr(lot?.superficie_m2 ?? null),
  };
}

async function chargerDonnees(table: string, rec: any): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    if (table === "attestations_cession") {
      if (rec.acquereur_id) Object.assign(out, await chargerAttributaire(rec.acquereur_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      // type_signature : "principal" (1er ayant-droit, gratuite, sans cession_id) -> 2 signatures
      //                  "tiers" (transmission/vente liee a une cession reelle) -> 1 signature (S/Chef seul)
      out.type_signature = rec.cession_id ? "tiers" : "principal";
    }

    if (table === "attestations_attribution_lot") {
      if (rec.titulaire_attributaire_id) Object.assign(out, await chargerAttributaire(rec.titulaire_attributaire_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      out.niveau = rec.niveau != null ? String(rec.niveau) : "—";
      out.gratuite = rec.gratuite ? "Oui" : "Non";
      out.nom_identifie_physique = rec.nom_identifie_physique ?? "—";
      // Chef de village + arrete de nomination -- l'attestation est signee
      // par la chefferie du lotissement, pas par le titulaire : ces infos
      // viennent de autorites_coutumieres via lots -> ilots -> lotissements,
      // pas d'une colonne directe sur attestations_attribution_lot.
      out.chef_village = "—"; out.numero_arrete_nomination = "—"; out.date_arrete_nomination = "—";
      if (rec.lot_id) {
        const { data: lotAc } = await supabase.from("lots")
          .select("ilots(lotissements(autorite_coutumiere_id))").eq("id", rec.lot_id).single();
        const autoriteId = (lotAc as any)?.ilots?.lotissements?.autorite_coutumiere_id;
        if (autoriteId) {
          const { data: ac } = await supabase.from("autorites_coutumieres")
            .select("chef,numero_arrete_nomination,date_arrete").eq("id", autoriteId).single();
          out.chef_village = ac?.chef ?? "—";
          out.numero_arrete_nomination = ac?.numero_arrete_nomination ?? "—";
          out.date_arrete_nomination = ac?.date_arrete ? dateFr(ac.date_arrete) : "—";
        }
      }
    }

    if (table === "certificats_vente") {
      if (rec.acquereur_id) Object.assign(out, await chargerAttributaire(rec.acquereur_id));
      if (rec.lot_id) Object.assign(out, await chargerLot(rec.lot_id));
      if (rec.vente_id) {
        const { data: v } = await supabase.from("ventes")
          .select("prix_total,type_vente,date_vente,nb_echeances,montant_paye,solde,vendeur_operateur_id,vendeur_famille_id")
          .eq("id", rec.vente_id).single();
        if (v) {
          out.prix_total = montantFr(v.prix_total);
          out.montant_paye = montantFr(v.montant_paye);
          out.solde = montantFr(v.solde);
          out.type_vente = v.type_vente ?? "—";
          out.nb_echeances = v.nb_echeances != null ? String(v.nb_echeances) : "—";
          out.date_vente = v.date_vente ? dateFr(v.date_vente) : "—";
          if (v.vendeur_operateur_id) {
            const { data: op } = await supabase.from("operateurs").select("nom").eq("id", v.vendeur_operateur_id).single();
            out.vendeur = op?.nom ?? "—";
          } else if (v.vendeur_famille_id) {
            const { data: fam } = await supabase.from("familles").select("nom").eq("id", v.vendeur_famille_id).single();
            out.vendeur = fam?.nom ?? "—";
          } else out.vendeur = "—";
        }
      }
    }

    if (table === "attestations_coutumieres") {
      if (rec.lotissement_id) {
        const { data: lo } = await supabase.from("lotissements")
          .select("nom,village,commune,district,superficie_texte,nb_ilots,nb_lots").eq("id", rec.lotissement_id).single();
        out.lotissement = lo?.nom ?? "—"; out.village = lo?.village ?? "—";
        out.commune = lo?.commune ?? "—"; out.district = lo?.district ?? "—";
        out.superficie = lo?.superficie_texte ?? "—";
        out.nb_ilots = lo?.nb_ilots != null ? String(lo.nb_ilots) : "—";
        out.nb_lots = lo?.nb_lots != null ? String(lo.nb_lots) : "—";
      }
      if (rec.famille_id) {
        const { data: fam } = await supabase.from("familles").select("nom,chef_de_famille,lignee:lignee_id(nom)").eq("id", rec.famille_id).single();
        out.famille = fam?.nom ?? "—"; out.lignee = fam?.lignee?.nom ?? "—";
        out.chef_de_famille = rec.chef_de_famille ?? fam?.chef_de_famille ?? "—";
      } else {
        out.chef_de_famille = rec.chef_de_famille ?? "—";
      }
      if (rec.autorite_coutumiere_id) {
        const { data: ac } = await supabase.from("autorites_coutumieres").select("nom,type,chef").eq("id", rec.autorite_coutumiere_id).single();
        out.autorite_coutumiere = ac?.nom ?? "—"; out.autorite_type = ac?.type ?? "—"; out.autorite_chef = ac?.chef ?? "—";
      }
      if (rec.cvgfr_id) {
        const { data: cv } = await supabase.from("cvgfr").select("president").eq("id", rec.cvgfr_id).single();
        out.cvgfr_president = cv?.president ?? "—";
      }
      out.non_contestation = rec.non_contestation ? "Oui" : "Non";
    }

    if (table === "paiements") {
      out.type_paiement = TYPE_PAIEMENT_LABELS[rec.type] ?? rec.type ?? "—";
      out.montant_total = montantFr(rec.montant_total);
      out.commission_sgfn = montantFr(rec.commission_sgfn);
      out.montant_reverse = rec.montant_reverse != null ? montantFr(rec.montant_reverse) : "—";
      out.beneficiaire = rec.beneficiaire ?? "—";
      out.moyen = MOYEN_LABELS[rec.moyen] ?? rec.moyen ?? "—";
      out.reference_externe = rec.reference_externe ?? "—";
      out.date_confirmation = dateFr(rec.confirme_le);
      if (rec.acquereur_id) {
        const att = await chargerAttributaire(rec.acquereur_id);
        out.beneficiaire = out.beneficiaire !== "—" ? out.beneficiaire : att.nom;
        out.acquereur_contacts = att.contacts;
      }
    }

    if (table === "pv_bornage") {
      const { data: m } = await supabase.from("missions_geometre")
        .select("client_nom,client_contact,lieu,type_mission,lot_id,geometre_id").eq("id", rec.mission_id).single();
      out.client_nom = m?.client_nom ?? "—";
      out.client_contact = m?.client_contact ?? "—";
      out.lieu = m?.lieu ?? "—";
      out.type_mission = TYPE_MISSION_LABELS[m?.type_mission ?? ""] ?? m?.type_mission ?? "—";
      if (m?.geometre_id) {
        const { data: ge } = await supabase.from("geometres_experts").select("nom,numero_ordre,cabinet").eq("id", m.geometre_id).single();
        out.geometre_nom = ge?.nom ?? "—";
        out.geometre_numero_ordre = ge?.numero_ordre ?? "—";
        out.geometre_cabinet = ge?.cabinet ?? "—";
      }
      if (m?.lot_id) {
        Object.assign(out, await chargerLot(m.lot_id));
      } else {
        out.lot = "—"; out.ilot = "—"; out.lotissement = "—"; out.superficie_enregistree = "—";
      }
      out.date_bornage = rec.date_bornage ? dateFr(rec.date_bornage) : "—";
      out.superficie_mesuree = superficieFr(rec.superficie_mesuree_m2 ?? null);
      out.observations = rec.observations ?? "—";
    }
  } catch (e) { console.error("chargerDonnees", table, e); }
  return out;
}

const QUITTANCE_GABARIT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>{{titre}} — {{reference}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, "Helvetica Neue", sans-serif;
    color: #1F2937;
    background: #ffffff;
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 18mm;
  }

  /* En-tête */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid #0D3B66;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .badge {
    width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .brand .badge svg { width: 26px; height: 26px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0D3B66; letter-spacing: 0.02em; }
  .brand .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .titre {
    font-size: 15px; font-weight: 800; color: #0D3B66; letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .doc-meta .ref { font-size: 12px; color: #475569; margin-top: 3px; font-family: "Courier New", monospace; }
  .doc-meta .date { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  /* Montant en avant */
  .montant-box {
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    border-radius: 14px;
    padding: 22px 26px;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .montant-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .montant-box .valeur { font-size: 30px; font-weight: 800; margin-top: 4px; }
  .montant-box .statut {
    background: rgba(255,255,255,0.18);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  /* Détails */
  .details {
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 28px;
  }
  .details .row {
    display: flex;
    padding: 12px 18px;
    border-bottom: 1px solid #F1F5F9;
  }
  .details .row:last-child { border-bottom: none; }
  .details .row:nth-child(even) { background: #F8FAFC; }
  .details .label { width: 42%; font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .details .value { width: 58%; font-size: 13px; color: #1F2937; font-weight: 600; }

  /* Vérification / QR */
  .verif {
    display: flex;
    align-items: center;
    gap: 18px;
    border: 1px dashed #CBD5E1;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 28px;
  }
  .verif img { width: 84px; height: 84px; flex-shrink: 0; }
  .verif .titre-verif { font-size: 12.5px; font-weight: 700; color: #0D3B66; }
  .verif .texte-verif { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .verif .url-verif { font-size: 10.5px; color: #1E6091; margin-top: 4px; word-break: break-all; }

  .mention-legale {
    font-size: 10px;
    color: #94a3b8;
    line-height: 1.6;
    border-top: 1px solid #E2E8F0;
    padding-top: 14px;
  }

  .footer {
    margin-top: 40px;
    text-align: center;
    font-size: 9.5px;
    color: #CBD5E1;
  }
</style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div>
        <div class="name">SGNF</div>
        <div class="tagline">Système de Gestion Numérique du Foncier</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="titre">{{titre}}</div>
      <div class="ref">{{reference}}</div>
      <div class="date">Émise le {{date}}</div>
    </div>
  </div>

  <div class="montant-box">
    <div>
      <div class="label">Montant payé</div>
      <div class="valeur">{{montant_total}}</div>
    </div>
    <div class="statut">Paiement confirmé</div>
  </div>

  <div class="details">
    <div class="row">
      <div class="label">Réglé par</div>
      <div class="value">{{beneficiaire}}</div>
    </div>
    <div class="row">
      <div class="label">Contact</div>
      <div class="value">{{acquereur_contacts}}</div>
    </div>
    <div class="row">
      <div class="label">Nature du paiement</div>
      <div class="value">{{type_paiement}}</div>
    </div>
    <div class="row">
      <div class="label">Moyen de paiement</div>
      <div class="value">{{moyen}}</div>
    </div>
    <div class="row">
      <div class="label">Référence de transaction</div>
      <div class="value">{{reference_externe}}</div>
    </div>
    <div class="row">
      <div class="label">Date de confirmation</div>
      <div class="value">{{date_confirmation}}</div>
    </div>
  </div>

  <div class="verif">
    <img src="{{qr_data_uri}}" alt="QR code de vérification" />
    <div>
      <div class="titre-verif">Vérifier l'authenticité de cette quittance</div>
      <div class="texte-verif">
        Scannez ce QR code avec l'appareil photo de votre téléphone, ou saisissez la
        référence <strong>{{reference}}</strong> sur la page de vérification SGNF.
      </div>
      <div class="url-verif">{{verify_url}}</div>
    </div>
  </div>

  <p class="mention-legale">
    Ce document atteste qu'un paiement a été reçu et confirmé par le Système de Gestion
    Numérique du Foncier (SGNF) pour le compte désigné ci-dessus. Il ne constitue ni un
    titre de propriété ni une attestation foncière — ces documents sont délivrés
    séparément une fois la démarche associée finalisée. Chaque vérification de ce document
    est journalisée par SGNF.
  </p>

  <div class="footer">SGNF — Système de Gestion Numérique du Foncier · Document généré automatiquement</div>

</body>
</html>
`;

const PV_BORNAGE_GABARIT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>{{titre}} — {{reference}}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, "Helvetica Neue", sans-serif;
    color: #1F2937;
    background: #ffffff;
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 18mm;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid #0D3B66; padding-bottom: 14px; margin-bottom: 28px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .badge {
    width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .brand .badge svg { width: 26px; height: 26px; }
  .brand .name { font-size: 20px; font-weight: 800; color: #0D3B66; letter-spacing: 0.02em; }
  .brand .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-meta .titre { font-size: 15px; font-weight: 800; color: #0D3B66; letter-spacing: 0.06em; text-transform: uppercase; }
  .doc-meta .ref { font-size: 12px; color: #475569; margin-top: 3px; font-family: "Courier New", monospace; }
  .doc-meta .date { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  .geometre-box {
    background: linear-gradient(135deg, #0D3B66, #1E6091);
    border-radius: 14px; padding: 18px 24px; color: #ffffff; margin-bottom: 24px;
  }
  .geometre-box .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .geometre-box .nom { font-size: 18px; font-weight: 800; margin-top: 3px; }
  .geometre-box .sous { font-size: 11.5px; margin-top: 4px; opacity: 0.9; }

  .superficies { display: flex; gap: 14px; margin-bottom: 24px; }
  .superficie-card {
    flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 18px;
  }
  .superficie-card .label { font-size: 10.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .superficie-card .valeur { font-size: 20px; font-weight: 800; color: #0D3B66; margin-top: 4px; }

  .details { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
  .details .row { display: flex; padding: 12px 18px; border-bottom: 1px solid #F1F5F9; }
  .details .row:last-child { border-bottom: none; }
  .details .row:nth-child(even) { background: #F8FAFC; }
  .details .label { width: 42%; font-size: 11.5px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .details .value { width: 58%; font-size: 13px; color: #1F2937; font-weight: 600; }

  .observations { border: 1px dashed #CBD5E1; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; }
  .observations .label { font-size: 10.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; }
  .observations .texte { font-size: 12.5px; color: #334155; line-height: 1.6; }

  .signatures { display: flex; gap: 14px; margin-bottom: 24px; }
  .signature-box { flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; }
  .signature-box .role { font-size: 11px; font-weight: 700; color: #0D3B66; text-transform: uppercase; letter-spacing: 0.03em; }
  .signature-box .ligne { border-top: 1px solid #CBD5E1; margin-top: 36px; padding-top: 6px; font-size: 10px; color: #94a3b8; }

  .verif {
    display: flex; align-items: center; gap: 18px; border: 1px dashed #CBD5E1;
    border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;
  }
  .verif img { width: 84px; height: 84px; flex-shrink: 0; }
  .verif .titre-verif { font-size: 12.5px; font-weight: 700; color: #0D3B66; }
  .verif .texte-verif { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
  .verif .url-verif { font-size: 10.5px; color: #1E6091; margin-top: 4px; word-break: break-all; }

  .mention-legale { font-size: 10px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #E2E8F0; padding-top: 14px; }
  .footer { margin-top: 40px; text-align: center; font-size: 9.5px; color: #CBD5E1; }
</style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div>
        <div class="name">SGNF</div>
        <div class="tagline">Système de Gestion Numérique du Foncier</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="titre">{{titre}}</div>
      <div class="ref">{{reference}}</div>
      <div class="date">Émis le {{date}} — bornage du {{date_bornage}}</div>
    </div>
  </div>

  <div class="geometre-box">
    <div class="label">Géomètre-expert</div>
    <div class="nom">{{geometre_nom}}</div>
    <div class="sous">{{geometre_cabinet}} · N° d'ordre {{geometre_numero_ordre}}</div>
  </div>

  <div class="superficies">
    <div class="superficie-card">
      <div class="label">Superficie mesurée</div>
      <div class="valeur">{{superficie_mesuree}}</div>
    </div>
    <div class="superficie-card">
      <div class="label">Superficie enregistrée</div>
      <div class="valeur">{{superficie_enregistree}}</div>
    </div>
  </div>

  <div class="details">
    <div class="row"><div class="label">Client / demandeur</div><div class="value">{{client_nom}}</div></div>
    <div class="row"><div class="label">Contact</div><div class="value">{{client_contact}}</div></div>
    <div class="row"><div class="label">Type de mission</div><div class="value">{{type_mission}}</div></div>
    <div class="row"><div class="label">Lieu</div><div class="value">{{lieu}}</div></div>
    <div class="row"><div class="label">Lot / lotissement</div><div class="value">{{lot}} · {{lotissement}}</div></div>
  </div>

  <div class="observations">
    <div class="label">Observations</div>
    <div class="texte">{{observations}}</div>
  </div>

  <div class="signatures">
    <div class="signature-box"><div class="role">Le demandeur</div><div class="ligne">Signature</div></div>
    <div class="signature-box"><div class="role">Le géomètre-expert</div><div class="ligne">Signature</div></div>
    <div class="signature-box"><div class="role">L'autorité coutumière</div><div class="ligne">Signature</div></div>
  </div>

  <div class="verif">
    <img src="{{qr_data_uri}}" alt="QR code de vérification" />
    <div>
      <div class="titre-verif">Vérifier l'authenticité de ce procès-verbal</div>
      <div class="texte-verif">
        Scannez ce QR code avec l'appareil photo de votre téléphone, ou saisissez la
        référence <strong>{{reference}}</strong> sur la page de vérification SGNF.
      </div>
      <div class="url-verif">{{verify_url}}</div>
    </div>
  </div>

  <p class="mention-legale">
    Ce procès-verbal constate les opérations de bornage réalisées par le géomètre-expert
    désigné ci-dessus. Il engage sa responsabilité professionnelle et n'a valeur légale
    définitive qu'une fois signé par l'ensemble des parties présentes. Chaque vérification
    de ce document est journalisée par SGNF.
  </p>

  <div class="footer">SGNF — Système de Gestion Numérique du Foncier · Document généré automatiquement</div>

</body>
</html>
`;

function gabaritInterne(cfg: { titre: string; type_doc: string }): string {
  if (cfg.type_doc === "quittance") return QUITTANCE_GABARIT;
  if (cfg.type_doc === "pv_bornage") return PV_BORNAGE_GABARIT;
  return `<!DOCTYPE html><html><body><h1>${cfg.titre}</h1><p>{{reference}} — document genere sans gabarit specifique (repli minimal)</p></body></html>`;
}

// Incruste le blason SGNF (bouclier + coche, meme trace que dans QUITTANCE_GABARIT/PV_BORNAGE_GABARIT)
// au centre d'un QR genere en errorCorrectionLevel "H" (tolere ~30% de recouvrement -- le badge
// n'en occupe qu'environ 7%, large marge de securite pour la lecture).
function incrusterLogoQr(svg: string, brandColor: string): string {
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb) return svg;
  const w = Number(vb[1]), h = Number(vb[2]);
  const badge = Math.max(6, Math.round(Math.min(w, h) * 0.26));
  const cx = w / 2, cy = h / 2;
  const r = badge / 2;
  const scale = badge / 24;
  const overlay = `<circle cx="${cx}" cy="${cy}" r="${r * 1.12}" fill="#ffffff"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${brandColor}"/>` +
    `<g transform="translate(${cx - badge / 2} ${cy - badge / 2}) scale(${scale})">` +
    `<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M9 12l2 2 4-4" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</g>`;
  return svg.replace("</svg>", overlay + "</svg>");
}

async function renderViaPdfMonkey(templateId: string, payload: Record<string, string>, filename: string): Promise<Uint8Array> {
  const res = await fetch("https://api.pdfmonkey.io/api/v1/documents/sync", {
    method: "POST",
    headers: { "Authorization": `Bearer ${PDFMONKEY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      document: { document_template_id: templateId, status: "pending", payload: JSON.stringify(payload), meta: { _filename: filename } },
    }),
  });
  if (!res.ok) throw new Error(`PDFMonkey HTTP ${res.status}: ${await res.text()}`);
  const card = await res.json();
  const doc = card.document_card ?? card.document ?? card;
  if (doc.status !== "success" || !doc.download_url) {
    throw new Error(`PDFMonkey statut=${doc.status} failure_cause=${JSON.stringify(doc.failure_cause ?? doc)}`);
  }
  const pdfRes = await fetch(doc.download_url);
  if (!pdfRes.ok) throw new Error(`Telechargement PDFMonkey HTTP ${pdfRes.status}`);
  return new Uint8Array(await pdfRes.arrayBuffer());
}

// --- Autorisation ----------------------------------------------------------
// Cette fonction n'est appelee QUE par les triggers/cron DB (pg_net via sgfn_call_edge),
// qui presentent un JWT de role "service_role". verify_jwt=true (plateforme) ne suffit PAS :
// la cle anon publique est elle aussi un JWT valide et passerait la verification plateforme.
// On exige donc service_role, OU l'en-tete applicatif x-hook-secret lorsque le secret
// HOOK_SECRET est configure (durcissement optionnel, defense en profondeur).
// La signature du JWT est deja validee par la plateforme (verify_jwt=on) : on se contente
// de lire le claim `role` du payload, sans reverifier la signature.
function roleDuJwt(req: Request): string | null {
  const m = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const seg = m[1].split(".")[1];
  if (!seg) return null;
  try {
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const secretOk = HOOK_SECRET ? req.headers.get("x-hook-secret") === HOOK_SECRET : false;
  const role = roleDuJwt(req);
  if (!secretOk && role !== "service_role") {
    console.warn(`generation-document: appel refuse (role=${role ?? "aucun"}, x-hook-secret=${secretOk})`);
    return new Response("Non autorise", { status: 401 });
  }

  const evt = await req.json().catch(() => ({}));

  // ---- MODE DIAGNOSTIC ----
  if (evt.debug === true) {
    const t = evt.table ?? "attestations_cession";
    const cfg = CONFIG[t];
    const tplId = cfg ? (Deno.env.get(cfg.pdfmonkeyEnv) ?? cfg.pdfmonkeyTemplateIdDefault) : null;
    const fnBaseDiag = (Deno.env.get("SUPABASE_URL") ?? "").replace(".supabase.co", ".functions.supabase.co");
    const verifyUrlSample = PUBLIC_VERIFY_BASE ? `${PUBLIC_VERIFY_BASE.replace(/\/+$/, "")}/?ref=SAMPLE-REF` : `${fnBaseDiag}/verification-qr?ref=SAMPLE-REF`;
    const diag: Record<string, unknown> = { table: t, hasApiKey: !!PDFMONKEY_API_KEY, hasTemplateId: !!tplId, templateId: tplId ?? null, hasPublicVerifyBase: !!PUBLIC_VERIFY_BASE, publicVerifyBase: PUBLIC_VERIFY_BASE ?? null, sampleVerifyUrl: verifyUrlSample };
    if (PDFMONKEY_API_KEY && tplId && cfg) {
      try {
        const sample: Record<string, string> = {
          titre: cfg.titre, reference: "DEBUG-0001", date: "24 Juin 2026",
          nom: "DIAGNOSTIC TEST", type_piece: "CNI", num_piece: "CI-9999", contacts: "+225 00 00",
          lotissement: "TEST-LOT", village: "EBIMPE", commune: "ANYAMA", ilot: "99", lot: "99",
          vendeur: "TEST OPERATEUR", prix_total: "1 000 000 FCFA", montant_paye: "500 000 FCFA", solde: "500 000 FCFA",
          type_vente: "comptant", nb_echeances: "1", date_vente: "24 Juin 2026",
          famille: "TEST FAMILLE", lignee: "TEST LIGNEE", chef_de_famille: "TEST CHEF",
          autorite_coutumiere: "TEST CHEFFERIE", autorite_type: "chefferie", autorite_chef: "TEST CHEF VILLAGE",
          cvgfr_president: "TEST PRESIDENT CVGFR", non_contestation: "Oui", district: "ABIDJAN",
          superficie: "1000 m2", nb_ilots: "10", nb_lots: "49", type_signature: evt.type_signature ?? "principal",
          qr_svg: "", qr_data_uri: "", verify_url: "https://example.com",
          type_paiement: "Vente terrain", montant_total: "250 000 FCFA", commission_sgfn: "10 000 FCFA",
          montant_reverse: "240 000 FCFA", beneficiaire: "TEST BENEFICIAIRE", moyen: "Wave",
          reference_externe: "cinetpay:TEST", date_confirmation: "24 Juin 2026", acquereur_contacts: "+225 00 00",
          client_nom: "TEST CLIENT", client_contact: "+225 00 00", type_mission: "Bornage",
          geometre_nom: "TEST GEOMETRE", geometre_numero_ordre: "TEST-0000", geometre_cabinet: "TEST CABINET",
          date_bornage: "24 Juin 2026", superficie_mesuree: "1 000 m²", superficie_enregistree: "1 000 m²", observations: "—",
          niveau: "2", gratuite: "Oui", nom_identifie_physique: "TEST IDENTIFIE PHYSIQUEMENT",
          chef_village: "TEST CHEF VILLAGE", numero_arrete_nomination: "99/PA/SG/D1", date_arrete_nomination: "24 Juin 2026",
          revoquee: "", revoquee_le: "",
        };
        const bytes = await renderViaPdfMonkey(tplId, sample, "debug.pdf");
        diag.success = true; diag.pdfSizeBytes = bytes.length;
      } catch (e) { diag.success = false; diag.error = String(e instanceof Error ? e.message : e); }
    }
    return new Response(JSON.stringify(diag, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  const table: string = evt.table;
  const rec = evt.record;
  const cfg = CONFIG[table];
  if (!cfg || !rec) return new Response("Table ignoree", { status: 200 });

  const d = await chargerDonnees(table, rec);

  const fnBase = (Deno.env.get("SUPABASE_URL") ?? "").replace(".supabase.co", ".functions.supabase.co");
  const refForQr = rec.reference ?? rec.numero ?? rec.id;
  const verifyUrl = PUBLIC_VERIFY_BASE
    ? `${PUBLIC_VERIFY_BASE.replace(/\/+$/, "")}/?token=${rec.qr_token ?? refForQr}`
    : `${fnBase}/verification-qr?ref=${refForQr}`;

  let qrSvg = "", qrDataUri = "";
  try {
    qrSvg = await QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "H" });
    if (cfg.brandColor) qrSvg = incrusterLogoQr(qrSvg, cfg.brandColor);
  } catch (e) { console.error("QR svg", e); }
  try { qrDataUri = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 }); } catch (e) { console.error("QR dataurl", e); }

  // Filigrane de revocation. Le gabarit PDFMonkey teste `{{revoquee}}` (chaine
  // vide = document normal) pour afficher « REVOQUEE » en arriere-plan.
  // `revoquer_attestation()` redeclenche cette generation apres revocation :
  // le PDF stocke est ecrase par sa version filigranee, de sorte qu'un
  // exemplaire retelecharge porte la mention, alors que les exemplaires deja
  // imprimes restent evidemment inchanges -- c'est la verification QR qui fait
  // foi pour ceux-la.
  const estRevoquee = String(rec.statut ?? "") === "revoquee";

  const baseVars: Record<string, string> = {
    titre: cfg.titre,
    reference: rec.reference ?? rec.numero ?? rec.id ?? "",
    date: dateFr(rec.date_emission ?? rec.date_delivrance ?? rec.confirme_le ?? rec.cree_le),
    qr_svg: qrSvg, qr_data_uri: qrDataUri, verify_url: verifyUrl,
    revoquee: estRevoquee ? "REVOQUEE" : "",
    revoquee_le: estRevoquee ? dateFr(rec.revoquee_le) : "",
    ...d,
  };

  let pdfmonkeyTemplateId = Deno.env.get(cfg.pdfmonkeyEnv) ?? cfg.pdfmonkeyTemplateIdDefault;
  if (table === "attestations_cession" && rec.lot_id) {
    // Surcharge par lotissement (ex. Brignan Kakodji) -- ne remplace le gabarit
    // global que si la colonne est renseignee pour ce lotissement precis.
    const { data: lotLo } = await supabase.from("lots")
      .select("ilots(lotissements(pdfmonkey_template_attestation_cession))")
      .eq("id", rec.lot_id).single();
    const override = (lotLo as any)?.ilots?.lotissements?.pdfmonkey_template_attestation_cession;
    if (override) pdfmonkeyTemplateId = override;
  }
  if (table === "attestations_attribution_lot" && rec.lot_id) {
    const { data: lotLo } = await supabase.from("lots")
      .select("ilots(lotissements(pdfmonkey_template_attestation_attribution))")
      .eq("id", rec.lot_id).single();
    const override = (lotLo as any)?.ilots?.lotissements?.pdfmonkey_template_attestation_attribution;
    if (override) pdfmonkeyTemplateId = override;
  }
  const filename = `${cfg.type_doc}_${baseVars.reference}.pdf`;

  async function renderFallback(): Promise<Response> {
    let html = (await chargerGabarit(cfg.template)) ?? gabaritInterne(cfg);
    html = html.replace(/\{\{(\w+)\}\}/g, (_m, k) => baseVars[k] ?? "");
    let b: Uint8Array, e: string, m: string;
    if (GOTENBERG_URL) {
      const form = new FormData();
      form.append("files", new File([html], "index.html", { type: "text/html" }));
      form.append("paperWidth", "8.27"); form.append("paperHeight", "11.69");
      form.append("marginTop", "0"); form.append("marginBottom", "0");
      form.append("marginLeft", "0"); form.append("marginRight", "0");
      form.append("printBackground", "true");
      const headers: Record<string, string> = {};
      if (GOTENBERG_USER && GOTENBERG_PASS) headers["Authorization"] = "Basic " + btoa(`${GOTENBERG_USER}:${GOTENBERG_PASS}`);
      const r = await fetch(`${GOTENBERG_URL.replace(/\/+$/, "")}/forms/chromium/convert/html`, { method: "POST", body: form, headers });
      if (!r.ok) { console.error("Gotenberg", r.status, await r.text()); return new Response("Erreur rendu PDF", { status: 502 }); }
      b = new Uint8Array(await r.arrayBuffer()); e = "pdf"; m = "application/pdf";
    } else {
      b = new TextEncoder().encode(html); e = "html"; m = "text/html";
    }
    return await deposer(b, e, m);
  }

  async function deposer(b: Uint8Array, e: string, m: string): Promise<Response> {
    const chemin = `${table}/${rec.reference ?? rec.numero ?? rec.id}.${e}`;
    const up = await supabase.storage.from("documents").upload(chemin, b, { contentType: m, upsert: true });
    if (up.error) { console.error(up.error); return new Response("Erreur stockage", { status: 500 }); }
    await supabase.from("documents").insert({ lot_id: rec.lot_id ?? null, type: cfg.type_doc, titre: cfg.titre, url_fichier: chemin });
    if (cfg.flipStatutDelivree) {
      await supabase.from(table).update({ statut: "delivree" }).eq("id", rec.id);
    }
    return new Response(JSON.stringify({ ok: true, fichier: chemin, format: e }), { headers: { "Content-Type": "application/json" } });
  }

  if (PDFMONKEY_API_KEY && pdfmonkeyTemplateId) {
    try {
      const bytes = await renderViaPdfMonkey(pdfmonkeyTemplateId, baseVars, filename);
      return await deposer(bytes, "pdf", "application/pdf");
    } catch (e) {
      console.error("PDFMonkey a echoue, repli sur Gotenberg/HTML:", e);
      return await renderFallback();
    }
  } else {
    return await renderFallback();
  }
});
