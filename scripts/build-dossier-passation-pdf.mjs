import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, "..", "docs");
const OUT_DIR = path.join(DOCS_DIR, "pdf");
mkdirSync(OUT_DIR, { recursive: true });

const logoPath = path.join(__dirname, "..", "public", "logo-embleme.png");
const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

// Ordre de lecture recommandé (voir docs/README.md)
const DOCS = [
  { file: "README.md", slug: "README", title: "Introduction" },
  { file: "03-ARCHITECTURE.md", slug: "03-ARCHITECTURE", title: "Architecture technique" },
  { file: "02-ROADMAP.md", slug: "02-ROADMAP", title: "État d'avancement & feuille de route" },
  { file: "04-DATABASE.md", slug: "04-DATABASE", title: "Base de données" },
  { file: "06-CODING_STANDARDS.md", slug: "06-CODING_STANDARDS", title: "Conventions & pièges connus" },
  { file: "05-DESIGN_SYSTEM.md", slug: "05-DESIGN_SYSTEM", title: "Design system" },
  { file: "01-VISION.md", slug: "01-VISION", title: "Vision du projet" },
];

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[(.+?)\]\((.+?)\)/g, (_m, label, href) => {
    const mdMatch = href.match(/^([\w.-]+)\.md$/);
    const target = mdMatch ? `#${mdMatch[1]}` : href;
    return `<a href="${target}">${label}</a>`;
  });
  return out;
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function markdownToHtml(md) {
  const lines = md.split("\n");
  let html = "";
  let i = 0;
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += "</ul>\n";
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Bloc de code ``` ... ```
    if (line.trim().startsWith("```")) {
      closeList();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // ligne de fermeture ```
      html += `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>\n`;
      continue;
    }

    // Table markdown
    if (line.trim().startsWith("|") && lines[i + 1] && /^\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1].trim())) {
      closeList();
      const header = parseTableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      html += "<table><thead><tr>";
      header.forEach((h) => (html += `<th>${inline(h)}</th>`));
      html += "</tr></thead><tbody>";
      rows.forEach((r) => {
        html += "<tr>";
        r.forEach((c) => (html += `<td>${inline(c)}</td>`));
        html += "</tr>";
      });
      html += "</tbody></table>\n";
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }
    if (line.trim() === "---") {
      closeList();
      html += "<hr>\n";
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      html += `<h1>${inline(line.slice(2))}</h1>\n`;
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      html += `<h2>${inline(line.slice(3))}</h2>\n`;
      i++;
      continue;
    }
    if (line.startsWith("| ")) {
      // ligne de table isolée déjà consommée plus haut, sécurité
      i++;
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inline(line.slice(2))}</li>\n`;
      i++;
      continue;
    }
    // paragraphe : accumule jusqu'à ligne vide/structurelle
    closeList();
    const para = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("* ") &&
      lines[i].trim() !== "---" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i]);
      i++;
    }
    html += `<p>${inline(para.join(" "))}</p>\n`;
  }
  closeList();
  return html;
}

function coverPageHtml() {
  const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return `
    <section class="cover">
      <img src="${logoDataUri}" alt="SGNF">
      <h1>Dossier de passation développeur</h1>
      <p class="subtitle">SGNF &amp; Mon Terrain</p>
      <p class="date">Généré le ${date}</p>
    </section>
    <div style="page-break-after: always;"></div>
    <section class="toc">
      <h1>Sommaire</h1>
      <ol>
        ${DOCS.filter((d) => d.slug !== "README")
          .map((d) => `<li><a href="#${d.slug}">${d.title}</a></li>`)
          .join("\n")}
      </ol>
    </section>
    <div style="page-break-after: always;"></div>
  `;
}

function fullHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Dossier de passation développeur — SGNF</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #0F172A;
    margin: 0;
    padding: 0 18mm;
    font-size: 10.5pt;
    line-height: 1.55;
  }
  section.cover {
    min-height: 200mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  section.cover img { height: 28mm; margin-bottom: 8mm; }
  section.cover h1 { font-size: 26pt; color: #0B5FA5; margin: 0; }
  section.cover .subtitle { font-size: 14pt; color: #1B8A5A; margin-top: 4mm; font-weight: 600; }
  section.cover .date { font-size: 10pt; color: #64748B; margin-top: 10mm; }
  section.toc h1 { color: #0B5FA5; font-size: 18pt; }
  section.toc ol { font-size: 13pt; line-height: 2.2; padding-left: 6mm; }
  section.toc a { color: #0F172A; text-decoration: none; }
  .doc-section { page-break-before: always; padding-top: 6mm; }
  h1 {
    color: #0B5FA5;
    font-size: 16pt;
    margin: 7mm 0 3mm 0;
  }
  h1:first-child { margin-top: 0; }
  h1 + p strong:first-child { color: #64748B; }
  h2 {
    color: #0B5FA5;
    font-size: 12pt;
    margin: 6mm 0 2mm 0;
    border-left: 3px solid #E88B16;
    padding-left: 3mm;
  }
  p { margin: 2mm 0; text-align: justify; }
  ul { margin: 2mm 0; padding-left: 5mm; }
  li { margin: 1.2mm 0; }
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 4mm 0; }
  a { color: #1B8A5A; text-decoration: none; font-weight: 600; }
  strong { color: #0F172A; }
  code {
    background: #F1F5F9;
    color: #0B5FA5;
    padding: 1px 4px;
    border-radius: 4px;
    font-family: "Consolas", "SF Mono", monospace;
    font-size: 9pt;
  }
  pre {
    background: #0F172A;
    color: #E2E8F0;
    padding: 4mm;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 8.5pt;
    line-height: 1.5;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9.5pt; }
  th, td { border: 1px solid #E2E8F0; padding: 2mm 2.5mm; text-align: left; vertical-align: top; }
  th { background: #F8FAFC; color: #0B5FA5; }
</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function headerHtml() {
  return `
    <div style="width:100%; margin:0 18mm; text-align:right; font-family: Arial, sans-serif;">
      <span style="font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">Dossier de passation — SGNF</span>
    </div>
  `;
}

let body = coverPageHtml();

for (const doc of DOCS) {
  const md = readFileSync(path.join(DOCS_DIR, doc.file), "utf8");
  const contentHtml = markdownToHtml(md);
  body += `<section class="doc-section" id="${doc.slug}">${contentHtml}</section>\n`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(fullHtml(body), { waitUntil: "networkidle" });

const pdfPath = path.join(OUT_DIR, "Dossier_Passation_SGNF.pdf");
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: headerHtml(),
  footerTemplate: `
    <div style="font-size:8px; color:#94a3b8; width:100%; text-align:center; font-family: Arial, sans-serif;">
      SGNF — Dossier de passation développeur · Page <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  `,
  margin: { top: "20mm", bottom: "14mm", left: "0mm", right: "0mm" },
});

await browser.close();
console.log(`PDF généré : ${pdfPath}`);
