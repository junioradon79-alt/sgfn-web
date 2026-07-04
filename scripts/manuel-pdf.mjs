import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANUEL_DIR = path.join(__dirname, "..", "manuel-utilisateur");
const HTML_PATH = path.join(MANUEL_DIR, "manuel.html");
const PDF_PATH = path.join(MANUEL_DIR, "Manuel_Utilisateur_SGNF.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${HTML_PATH.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });

await page.pdf({
  path: PDF_PATH,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate: `
    <div style="font-size:9px; color:#94a3b8; width:100%; text-align:center; font-family: Arial, sans-serif;">
      SGNF — Manuel utilisateur · Page <span class="pageNumber"></span> / <span class="totalPages"></span>
    </div>
  `,
  margin: { top: "22mm", bottom: "16mm", left: "16mm", right: "16mm" },
});

await browser.close();
console.log(`PDF généré : ${PDF_PATH}`);
