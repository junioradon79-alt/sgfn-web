import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "..", "dossiers-partenaires");
const OUT_DIR = path.join(SRC_DIR, "pdf");
mkdirSync(OUT_DIR, { recursive: true });

const logoPath = path.join(__dirname, "..", "public", "logo-officiel.png");
const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

function inline(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
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
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      html += `<li>${inline(line.slice(2))}</li>\n`;
      i++;
      continue;
    }
    // paragraphe : accumule les lignes jusqu'à une ligne vide/structurelle
    closeList();
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("- ") && lines[i].trim() !== "---") {
      para.push(lines[i]);
      i++;
    }
    html += `<p>${inline(para.join(" "))}</p>\n`;
  }
  closeList();
  return html;
}

function pageHtml(bodyHtml, title) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    color: #0F172A;
    margin: 0;
    padding: 30mm 18mm 20mm 18mm;
    font-size: 11pt;
    line-height: 1.55;
  }
  .brand {
    position: fixed;
    top: 8mm;
    left: 18mm;
    right: 18mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #0B5FA5;
    padding-bottom: 4mm;
  }
  .brand img { height: 11mm; }
  .brand .tag {
    font-size: 9pt;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h1 {
    color: #0B5FA5;
    font-size: 20pt;
    margin: 0 0 2mm 0;
  }
  h1 + p {
    color: #64748B;
    font-size: 10.5pt;
    margin-top: 0;
  }
  h2 {
    color: #0B5FA5;
    font-size: 13pt;
    margin: 7mm 0 2mm 0;
    border-left: 3px solid #E88B16;
    padding-left: 3mm;
  }
  p { margin: 2mm 0; text-align: justify; }
  ul { margin: 2mm 0; padding-left: 5mm; }
  li { margin: 1.5mm 0; }
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 5mm 0; }
  a { color: #1B8A5A; text-decoration: none; font-weight: 600; }
  strong { color: #0F172A; }
</style>
</head>
<body>
  <div class="brand">
    <img src="${logoDataUri}" alt="SGNF">
    <span class="tag">Dossier partenaire</span>
  </div>
  ${bodyHtml}
</body>
</html>`;
}

const files = readdirSync(SRC_DIR)
  .filter((f) => f.endsWith(".md") && f !== "00-README.md")
  .sort();

const browser = await chromium.launch();
const page = await browser.newPage();

for (const file of files) {
  const md = readFileSync(path.join(SRC_DIR, file), "utf8");
  const titleMatch = md.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1] : file;
  const bodyHtml = markdownToHtml(md);

  await page.setContent(pageHtml(bodyHtml, title), { waitUntil: "networkidle" });

  const pdfName = file.replace(/\.md$/, ".pdf");
  const pdfPath = path.join(OUT_DIR, pdfName);
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="font-size:8px; color:#94a3b8; width:100%; text-align:center; font-family: Arial, sans-serif;">
        SGNF — ${title} · Page <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
    margin: { top: "34mm", bottom: "14mm", left: "18mm", right: "18mm" },
  });
  console.log(`[OK] ${pdfName}`);
}

await browser.close();
